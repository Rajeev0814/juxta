import { describe, expect, it } from 'vitest'
import { firstDifference, toHexDump } from '../src/core/hex'

describe('toHexDump', () => {
  it('formats offset, hex bytes and ascii', () => {
    const out = toHexDump(Buffer.from('Hi', 'ascii'))
    expect(out).toBe('00000000  48 69' + ' '.repeat(47 - 5) + '  |Hi|')
  })

  it('renders non-printable bytes as dots', () => {
    const out = toHexDump(Buffer.from([0x00, 0x41, 0x7f]))
    expect(out).toContain('00 41 7f')
    expect(out).toContain('|.A.|')
  })

  it('wraps to multiple rows with increasing offsets', () => {
    const buf = Buffer.alloc(20, 0x61) // 20 'a' bytes
    const lines = toHexDump(buf, { bytesPerRow: 16 }).split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0].startsWith('00000000  ')).toBe(true)
    expect(lines[1].startsWith('00000010  ')).toBe(true) // offset 16
  })

  it('truncates at maxBytes and notes the remainder', () => {
    const buf = Buffer.alloc(10, 0x62)
    const out = toHexDump(buf, { bytesPerRow: 4, maxBytes: 4 })
    expect(out).toContain('… (6 more bytes not shown)')
    // one data row (4 bytes) + the note
    expect(out.split('\n')).toHaveLength(2)
  })

  it('labels addresses from startOffset for windowed views', () => {
    const out = toHexDump(Buffer.from('Hi', 'ascii'), { startOffset: 0x1000 })
    expect(out.startsWith('00001000  48 69')).toBe(true)
  })
})

describe('firstDifference', () => {
  it('finds the first differing byte', () => {
    expect(firstDifference(Buffer.from('abcXe'), Buffer.from('abcYe'))).toBe(3)
  })
  it('returns -1 for identical buffers', () => {
    expect(firstDifference(Buffer.from('same'), Buffer.from('same'))).toBe(-1)
  })
  it('returns the common length when one is a prefix of the other', () => {
    expect(firstDifference(Buffer.from('abc'), Buffer.from('abcdef'))).toBe(3)
  })
})
