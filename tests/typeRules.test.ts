import { describe, expect, it } from 'vitest'
import { resolveTypeRules } from '../src/core/filters'
import { compareFolders } from '../src/core/compare'
import { DEFAULT_FILTERS, type CompareOptions, type FileTypeRule } from '../src/shared/types'
import { makeTree } from './helpers'

describe('resolveTypeRules', () => {
  const rules: FileTypeRule[] = [{ glob: '*.md', ignoreWhitespace: true }]

  it('matches by extension at any depth, by full path or bare name', () => {
    expect(resolveTypeRules('README.md', rules)).toEqual({ ignoreWhitespace: true })
    expect(resolveTypeRules('docs/guide.md', rules)).toEqual({ ignoreWhitespace: true })
    expect(resolveTypeRules('notes.txt', rules)).toBeNull()
  })

  it('returns null when there are no rules', () => {
    expect(resolveTypeRules('a.md', [])).toBeNull()
  })

  it('merges matching rules with later ones winning', () => {
    const merged = resolveTypeRules('a.md', [
      { glob: '*.md', ignoreWhitespace: true, ignoreCase: true },
      { glob: '*.md', ignoreCase: false }
    ])
    expect(merged).toEqual({ ignoreWhitespace: true, ignoreCase: false })
  })
})

describe('per-file-type rules in a folder compare', () => {
  it('applies a rule only to matching files', async () => {
    const left = await makeTree({ 'a.md': 'x  y', 'a.txt': 'x  y' })
    const right = await makeTree({ 'a.md': 'x y', 'a.txt': 'x y' })
    const options: CompareOptions = {
      method: 'content',
      filters: { ...DEFAULT_FILTERS, excludeGlobs: [], typeRules: [{ glob: '*.md', ignoreWhitespace: true }] }
    }
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options })

    // .md is normalized (whitespace ignored) -> identical; .txt is not -> different.
    expect(res.summary.identical).toBe(1)
    expect(res.summary.different).toBe(1)
  })
})
