import { describe, expect, it } from 'vitest'
import { compareFolders } from '../src/core/compare'
import { ancestorsOf, collectDirRelPaths, listChangedFiles } from '../src/shared/nav'
import { DEFAULT_FILTERS, type CompareOptions } from '../src/shared/types'
import { makeTree } from './helpers'

const options: CompareOptions = { method: 'content', filters: { ...DEFAULT_FILTERS, excludeGlobs: [] } }

describe('ancestorsOf', () => {
  it('lists ancestor directories root-first', () => {
    expect(ancestorsOf('a/b/c.txt')).toEqual(['a', 'a/b'])
    expect(ancestorsOf('top.txt')).toEqual([])
  })
})

describe('listChangedFiles', () => {
  it('lists only changed files, in visual tree order, skipping identical and dirs', async () => {
    const left = await makeTree({
      'a/deep.txt': 'L',
      'a/same.txt': 'x',
      'b/diff.txt': 'one',
      'top-left.txt': 'only-left'
    })
    const right = await makeTree({
      'a/same.txt': 'x',
      'b/diff.txt': 'two',
      'top-right.txt': 'only-right'
    })
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options })
    const changed = listChangedFiles(res.root)

    // a/deep.txt (left-only), b/diff.txt (different), then root files
    expect(changed).toEqual(['a/deep.txt', 'b/diff.txt', 'top-left.txt', 'top-right.txt'])
    expect(changed).not.toContain('a/same.txt')
  })

  it('collects all directory relPaths (nested), excluding the root and files', async () => {
    const left = await makeTree({ 'a/b/c.txt': 'x', 'a/d.txt': 'y', 'top.txt': 'z' })
    const right = await makeTree({ 'a/b/c.txt': 'x2' })
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options })
    expect(collectDirRelPaths(res.root).sort()).toEqual(['a', 'a/b'])
  })

  it('returns an empty list when trees are identical', async () => {
    const left = await makeTree({ 'x.txt': 'same' })
    const right = await makeTree({ 'x.txt': 'same' })
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options })
    expect(listChangedFiles(res.root)).toEqual([])
  })
})
