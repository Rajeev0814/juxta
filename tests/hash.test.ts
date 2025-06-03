import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { hashFile, hashFileRaw, normalizeText } from '../src/core/hash'
import { makeTree } from './helpers'

describe('normalizeText', () => {
  it('collapses internal whitespace and trims lines', () => {
    expect(normalizeText('a   b\n   c  ')).toBe('a b\nc')
  })
  it('normalizes CRLF to LF', () => {
    expect(normalizeText('a\r\nb')).toBe('a\nb')
  })
})

describe('hashFile', () => {
  it('produces equal raw hashes for byte-identical files', async () => {
    const root = await makeTree({ 'a.txt': 'content', 'b.txt': 'content' })
    const ha = await hashFileRaw(join(root, 'a.txt'))
    const hb = await hashFileRaw(join(root, 'b.txt'))
    expect(ha).toBe(hb)
  })

  it('hashes whitespace-different files equally when ignoreWhitespace is set', async () => {
    const root = await makeTree({ 'a.txt': 'x  y', 'b.txt': 'x y' })
    const ha = await hashFile(join(root, 'a.txt'), { ignoreWhitespace: true, ignoreCase: false })
    const hb = await hashFile(join(root, 'b.txt'), { ignoreWhitespace: true, ignoreCase: false })
    expect(ha).toBe(hb)
  })
})
