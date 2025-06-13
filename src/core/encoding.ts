// Text encoding + line-ending detection for the file diff. Pure (operates on a
// Buffer) and unit-tested. Handles UTF-8 (with/without BOM) and UTF-16 LE/BE
// (with BOM, and a BOM-less heuristic), so e.g. UTF-16 files aren't mistaken
// for binary (their NUL bytes) or mis-decoded.

export type Encoding = 'utf8' | 'utf8-bom' | 'utf16le' | 'utf16be'

export interface EncodingInfo {
  encoding: Encoding
  bomLength: number
}

export function detectEncoding(buf: Buffer): EncodingInfo {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { encoding: 'utf8-bom', bomLength: 3 }
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { encoding: 'utf16le', bomLength: 2 }
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return { encoding: 'utf16be', bomLength: 2 }
  }
  // BOM-less UTF-16 heuristic: ASCII text has a zero high byte on one parity.
  const sample = Math.min(buf.length, 1024)
  let zerosEven = 0
  let zerosOdd = 0
  for (let i = 0; i < sample; i++) {
    if (buf[i] === 0) {
      if (i % 2 === 0) zerosEven++
      else zerosOdd++
    }
  }
  const threshold = sample * 0.2
  if (zerosOdd > threshold && zerosOdd >= zerosEven) return { encoding: 'utf16le', bomLength: 0 }
  if (zerosEven > threshold && zerosEven > zerosOdd) return { encoding: 'utf16be', bomLength: 0 }
  return { encoding: 'utf8', bomLength: 0 }
}

/** Decode a buffer to a string using detected (or supplied) encoding. */
export function decodeText(buf: Buffer, info: EncodingInfo = detectEncoding(buf)): string {
  const body = buf.subarray(info.bomLength)
  switch (info.encoding) {
    case 'utf16le':
      return body.toString('utf16le')
    case 'utf16be': {
      // Node has no 'utf16be'; swap byte pairs into LE.
      const swapped = Buffer.from(body) // copy
      for (let i = 0; i + 1 < swapped.length; i += 2) {
        const t = swapped[i]
        swapped[i] = swapped[i + 1]
        swapped[i + 1] = t
      }
      return swapped.toString('utf16le')
    }
    default:
      return body.toString('utf8')
  }
}

export function encodingLabel(e: Encoding): string {
  switch (e) {
    case 'utf8':
      return 'UTF-8'
    case 'utf8-bom':
      return 'UTF-8 BOM'
    case 'utf16le':
      return 'UTF-16 LE'
    case 'utf16be':
      return 'UTF-16 BE'
  }
}

export type Eol = 'lf' | 'crlf' | 'mixed' | 'none'

export function detectEol(text: string): Eol {
  const crlf = (text.match(/\r\n/g) ?? []).length
  const lfTotal = (text.match(/\n/g) ?? []).length
  const lfOnly = lfTotal - crlf
  if (crlf > 0 && lfOnly > 0) return 'mixed'
  if (crlf > 0) return 'crlf'
  if (lfOnly > 0) return 'lf'
  return 'none'
}

export function eolLabel(e: Eol): string {
  switch (e) {
    case 'lf':
      return 'LF'
    case 'crlf':
      return 'CRLF'
    case 'mixed':
      return 'Mixed'
    case 'none':
      return '—'
  }
}
