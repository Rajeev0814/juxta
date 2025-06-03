import { describe, expect, it } from 'vitest'
import { compareFolders } from '../src/core/compare'
import { DEFAULT_FILTERS, type CompareOptions } from '../src/shared/types'
import { indexNodes, makeTree } from './helpers'

function opts(patch: Partial<CompareOptions> = {}): CompareOptions {
  return {
    method: 'content',
    filters: { ...DEFAULT_FILTERS, excludeGlobs: [] },
    ...patch
  }
}

describe('compareFolders — content method', () => {
  it('classifies identical, different, left-only and right-only entries', async () => {
    const left = await makeTree({
      'same.txt': 'hello',
      'diff.txt': 'left version',
      'onlyleft.txt': 'L',
      'sub/a.txt': 'a',
      'sub/leftonly.txt': 'x'
    })
    const right = await makeTree({
      'same.txt': 'hello',
      'diff.txt': 'right version!!',
      'onlyright.txt': 'R',
      'sub/a.txt': 'a'
    })

    const res = await compareFolders({ leftRoot: left, rightRoot: right, options: opts() })
    const nodes = indexNodes(res.root)

    expect(nodes.get('same.txt')!.status).toBe('identical')
    expect(nodes.get('diff.txt')!.status).toBe('different')
    expect(nodes.get('onlyleft.txt')!.status).toBe('leftOnly')
    expect(nodes.get('onlyright.txt')!.status).toBe('rightOnly')
    expect(nodes.get('sub/a.txt')!.status).toBe('identical')
    expect(nodes.get('sub/leftonly.txt')!.status).toBe('leftOnly')

    expect(res.summary.identical).toBe(2)
    expect(res.summary.different).toBe(1)
    expect(res.summary.leftOnly).toBe(2)
    expect(res.summary.rightOnly).toBe(1)
    expect(res.summary.totalFiles).toBe(6)
  })

  it('marks a directory present on both sides as different when a child differs', async () => {
    const left = await makeTree({ 'sub/a.txt': 'one' })
    const right = await makeTree({ 'sub/a.txt': 'two' })
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options: opts() })
    const nodes = indexNodes(res.root)
    expect(nodes.get('sub')!.status).toBe('different')
  })

  it('reports a directory existing on one side only as left/right-only', async () => {
    const left = await makeTree({ 'onlydir/a.txt': 'x', 'onlydir/b.txt': 'y' })
    const right = await makeTree({ 'keep.txt': 'k' })
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options: opts() })
    const nodes = indexNodes(res.root)
    expect(nodes.get('onlydir')!.status).toBe('leftOnly')
    expect(nodes.get('onlydir/a.txt')!.status).toBe('leftOnly')
  })
})

describe('compareFolders — ignore whitespace', () => {
  it('treats files differing only by whitespace as identical', async () => {
    const left = await makeTree({ 'f.txt': 'a  b\n  c' })
    const right = await makeTree({ 'f.txt': 'a b\nc' })

    const without = await compareFolders({ leftRoot: left, rightRoot: right, options: opts() })
    expect(indexNodes(without.root).get('f.txt')!.status).toBe('different')

    const withWs = await compareFolders({
      leftRoot: left,
      rightRoot: right,
      options: opts({ filters: { ...DEFAULT_FILTERS, excludeGlobs: [], ignoreWhitespace: true } })
    })
    expect(indexNodes(withWs.root).get('f.txt')!.status).toBe('identical')
  })
})

describe('compareFolders — quick and size+time methods', () => {
  it('quick method considers equal-size files identical even if content differs', async () => {
    const left = await makeTree({ 'f.txt': 'abcd' })
    const right = await makeTree({ 'f.txt': 'wxyz' }) // same size, different content
    const res = await compareFolders({
      leftRoot: left,
      rightRoot: right,
      options: opts({ method: 'quick' })
    })
    expect(indexNodes(res.root).get('f.txt')!.status).toBe('identical')
  })

  it('size+time method flags files with different timestamps', async () => {
    const left = await makeTree({ 'f.txt': { content: 'abcd', mtime: 1_000_000_000_000 } })
    const right = await makeTree({ 'f.txt': { content: 'abcd', mtime: 1_700_000_000_000 } })
    const res = await compareFolders({
      leftRoot: left,
      rightRoot: right,
      options: opts({ method: 'sizeAndTime' })
    })
    const node = indexNodes(res.root).get('f.txt')!
    expect(node.status).toBe('different')
    expect(node.newer).toBe('right')
  })
})

describe('compareFolders — .gitignore support', () => {
  it('applies each root .gitignore when useGitignore is on', async () => {
    const left = await makeTree({
      '.gitignore': 'ignored.txt\nbuild/\n',
      'keep.txt': 'k',
      'ignored.txt': 'secret',
      'build/out.js': 'compiled'
    })
    const right = await makeTree({ 'keep.txt': 'k' })

    const off = await compareFolders({ leftRoot: left, rightRoot: right, options: opts() })
    expect(indexNodes(off.root).get('ignored.txt')!.status).toBe('leftOnly')
    expect(indexNodes(off.root).has('build')).toBe(true)

    const on = await compareFolders({
      leftRoot: left,
      rightRoot: right,
      options: opts({ filters: { ...DEFAULT_FILTERS, excludeGlobs: [], useGitignore: true } })
    })
    const nodes = indexNodes(on.root)
    expect(nodes.has('ignored.txt')).toBe(false)
    expect(nodes.has('build')).toBe(false)
    expect(nodes.get('keep.txt')!.status).toBe('identical')
  })
})

describe('compareFolders — filters', () => {
  it('excludes files matching an exclude glob', async () => {
    const left = await makeTree({ 'keep.txt': 'a', 'skip.log': 'b' })
    const right = await makeTree({ 'keep.txt': 'a' })
    const res = await compareFolders({
      leftRoot: left,
      rightRoot: right,
      options: opts({ filters: { ...DEFAULT_FILTERS, excludeGlobs: ['*.log'] } })
    })
    const nodes = indexNodes(res.root)
    expect(nodes.has('skip.log')).toBe(false)
    expect(nodes.get('keep.txt')!.status).toBe('identical')
  })
})
