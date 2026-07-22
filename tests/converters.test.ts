import { describe, expect, it } from 'vitest'
import {
  coerceConverters,
  extensionOf,
  findConverter,
  buildConverterInvocation,
  type FormatConverter
} from '../src/shared/converters'

describe('extensionOf', () => {
  it('returns the lowercase extension without the dot', () => {
    expect(extensionOf('C:/docs/Report.RTF')).toBe('rtf')
    expect(extensionOf('/tmp/notes.md')).toBe('md')
    expect(extensionOf('a.tar.gz')).toBe('gz')
  })
  it('returns empty for no extension or a dotfile', () => {
    expect(extensionOf('Makefile')).toBe('')
    expect(extensionOf('/etc/.bashrc')).toBe('')
  })
})

describe('coerceConverters', () => {
  it('keeps valid entries and normalizes extensions (dot/case stripped)', () => {
    const out = coerceConverters([
      { name: 'RTF', extensions: ['.RTF', 'rtf '], command: 'unrtf', args: ['--text', '${file}'] }
    ])
    expect(out).toEqual([
      { name: 'RTF', extensions: ['rtf', 'rtf'], command: 'unrtf', args: ['--text', '${file}'] }
    ])
  })

  it('drops entries missing a name, command, or extensions', () => {
    expect(
      coerceConverters([
        { name: '', command: 'x', extensions: ['a'] },
        { name: 'N', command: '', extensions: ['a'] },
        { name: 'N', command: 'x', extensions: [] },
        'not an object',
        42
      ])
    ).toEqual([])
  })

  it('defaults args to [] and returns [] for non-arrays', () => {
    expect(coerceConverters([{ name: 'N', command: 'c', extensions: ['x'] }])[0].args).toEqual([])
    expect(coerceConverters({})).toEqual([])
    expect(coerceConverters(null)).toEqual([])
  })
})

describe('findConverter', () => {
  const list: FormatConverter[] = [
    { name: 'RTF', extensions: ['rtf'], command: 'unrtf', args: [] },
    { name: 'Notebook', extensions: ['ipynb'], command: 'jupyter', args: [] }
  ]
  it('matches by extension, case-insensitively', () => {
    expect(findConverter(list, 'a/b/File.RTF')?.name).toBe('RTF')
    expect(findConverter(list, 'nb.ipynb')?.name).toBe('Notebook')
  })
  it('returns null when nothing matches or there is no extension', () => {
    expect(findConverter(list, 'a.txt')).toBeNull()
    expect(findConverter(list, 'Makefile')).toBeNull()
  })
})

describe('buildConverterInvocation', () => {
  it('substitutes the ${file} token wherever it appears', () => {
    const conv: FormatConverter = { name: 'N', extensions: ['rtf'], command: 'unrtf', args: ['--text', '${file}'] }
    expect(buildConverterInvocation(conv, 'C:/a b.rtf')).toEqual({
      command: 'unrtf',
      args: ['--text', 'C:/a b.rtf']
    })
  })
  it('appends the path when no token is present', () => {
    const conv: FormatConverter = { name: 'N', extensions: ['rtf'], command: 'pandoc', args: ['-t', 'plain'] }
    expect(buildConverterInvocation(conv, '/x.rtf')).toEqual({
      command: 'pandoc',
      args: ['-t', 'plain', '/x.rtf']
    })
  })
})
