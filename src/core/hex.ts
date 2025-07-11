// Classic hex dump: `offset  hex bytes…  |ascii|`, used to view/compare binary
// files. Pure and unit-tested.

export interface HexDumpOptions {
  bytesPerRow?: number
  /** Cap the number of bytes rendered (a note is appended if truncated). */
  maxBytes?: number
  /** Value of the first byte's address, for windowed views into a larger file. */
  startOffset?: number
}

export function toHexDump(buf: Buffer, options: HexDumpOptions = {}): string {
  const perRow = options.bytesPerRow ?? 16
  const max = options.maxBytes ?? buf.length
  const len = Math.min(buf.length, max)
  const startOffset = options.startOffset ?? 0
  const hexColWidth = perRow * 3 - 1

  const lines: string[] = []
  for (let off = 0; off < len; off += perRow) {
    const end = Math.min(off + perRow, len)
    let hex = ''
    let ascii = ''
    for (let i = off; i < end; i++) {
      const b = buf[i]
      hex += (i > off ? ' ' : '') + b.toString(16).padStart(2, '0')
      ascii += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'
    }
    const offset = (startOffset + off).toString(16).padStart(8, '0')
    lines.push(`${offset}  ${hex.padEnd(hexColWidth, ' ')}  |${ascii}|`)
  }
  if (buf.length > len) {
    lines.push(`… (${buf.length - len} more bytes not shown)`)
  }
  return lines.join('\n')
}

/**
 * Index of the first byte at which `a` and `b` differ. Returns -1 if they are
 * identical over their common length; if one is a prefix of the other, returns
 * that common length (the point of divergence). Pure.
 */
export function firstDifference(a: Buffer, b: Buffer): number {
  const min = Math.min(a.length, b.length)
  for (let i = 0; i < min; i++) {
    if (a[i] !== b[i]) return i
  }
  return a.length === b.length ? -1 : min
}
