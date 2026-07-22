import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { dropIgnoredLines, hashFile, hashFileRaw, normalizeText, stripBlankLines } from '../src/core/hash'
import { makeTree } from './helpers'

describe('normalizeText', () => {
  it('collapses internal whitespace and trims lines', () => {
    expect(normalizeText('a   b\n   c  ')).toBe('a b\nc')
  })
  it('normalizes CRLF to LF', () => {
    expect(normalizeText('a\r\nb')).toBe('a\nb')
  })
})

describe('dropIgnoredLines', () => {
  it('removes lines matching the regex', () => {
    expect(dropIgnoredLines('a\n// note\nb', '^\\s*//')).toBe('a\nb')
  })
  it('returns text unchanged for empty or invalid pattern', () => {
    expect(dropIgnoredLines('a\nb', '')).toBe('a\nb')
    expect(dropIgnoredLines('a\nb', '(')).toBe('a\nb') // invalid regex
  })
})

describe('stripBlankLines', () => {
  it('drops blank and whitespace-only lines, keeps the rest', () => {
    expect(stripBlankLines('a\n\nb\n   \nc')).toBe('a\nb\nc')
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

  it('hashes blank-line-different files equally when ignoreBlankLines is set', async () => {
    const root = await makeTree({ 'a.txt': 'x\n\n\ny', 'b.txt': 'x\ny' })
    const opts = { ignoreWhitespace: false, ignoreCase: false, ignoreBlankLines: true }
    const ha = await hashFile(join(root, 'a.txt'), opts)
    const hb = await hashFile(join(root, 'b.txt'), opts)
    expect(ha).toBe(hb)
  })

  it('canonicalizes .yaml files when normalizeYaml is set (key order ignored)', async () => {
    const root = await makeTree({ 'a.yaml': 'b: 1\na: 2\n', 'b.yaml': 'a: 2\nb: 1\n' })
    const opts = { ignoreWhitespace: false, ignoreCase: false, normalizeYaml: true }
    const ha = await hashFile(join(root, 'a.yaml'), opts)
    const hb = await hashFile(join(root, 'b.yaml'), opts)
    expect(ha).toBe(hb)
  })

  it('canonicalizes .xml files when normalizeXml is set (formatting & attr order ignored)', async () => {
    const root = await makeTree({
      'a.xml': '<r a="1" b="2"><c>t</c></r>',
      'b.xml': '<r b="2" a="1">\n  <c>t</c>\n</r>'
    })
    const opts = { ignoreWhitespace: false, ignoreCase: false, normalizeXml: true }
    const ha = await hashFile(join(root, 'a.xml'), opts)
    const hb = await hashFile(join(root, 'b.xml'), opts)
    expect(ha).toBe(hb)
  })

  it('canonicalizes .lua files by AST when normalizeCode is set (comments/formatting ignored)', async () => {
    const root = await makeTree({
      'a.lua': '-- greet\nlocal x = 1\nfunction f(a) return a+1 end',
      'b.lua': 'local x = 1;\nfunction f(a)\n  return a + 1\nend'
    })
    const opts = { ignoreWhitespace: false, ignoreCase: false, normalizeCode: true }
    const ha = await hashFile(join(root, 'a.lua'), opts)
    const hb = await hashFile(join(root, 'b.lua'), opts)
    expect(ha).toBe(hb)
  })

  it('keeps semantically different .lua files distinct under normalizeCode', async () => {
    const root = await makeTree({ 'a.lua': 'local x = 1', 'b.lua': 'local x = 2' })
    const opts = { ignoreWhitespace: false, ignoreCase: false, normalizeCode: true }
    const ha = await hashFile(join(root, 'a.lua'), opts)
    const hb = await hashFile(join(root, 'b.lua'), opts)
    expect(ha).not.toBe(hb)
  })
})
