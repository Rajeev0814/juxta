// Classic hex dump: `offset  hex bytes…  |ascii|`, used to view/compare binary
// files. Pure and unit-tested.

export interface HexDumpOptions {
  bytesPerRow?: number
  /** Cap the number of bytes rendered (a note is appended if truncated). */
  maxBytes?: number
}

export function toHexDump(buf: Buffer, options: HexDumpOptions = {}): string {
  const perRow = options.bytesPerRow ?? 16
  const max = options.maxBytes ?? buf.length
  const len = Math.min(buf.length, max)
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
    const offset = off.toString(16).padStart(8, '0')
    lines.push(`${offset}  ${hex.padEnd(hexColWidth, ' ')}  |${ascii}|`)
  }
  if (buf.length > len) {
    lines.push(`… (${buf.length - len} more bytes not shown)`)
  }
  return lines.join('\n')
}
