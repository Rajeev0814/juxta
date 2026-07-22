import { describe, expect, it } from 'vitest'
import type { CompareNode } from '../src/shared/types'
import { flatten, visibleForNameFilter } from '../src/renderer/src/lib/treeUtils'

/** A small tree: /src/app.ts, /src/util.ts, /README.md */
function tree(): CompareNode {
  const file = (name: string, relPath: string): CompareNode => ({
    name,
    relPath,
    kind: 'file',
    status: 'different'
  })
  return {
    name: '',
    relPath: '',
    kind: 'directory',
    status: 'different',
    children: [
      {
        name: 'src',
        relPath: 'src',
        kind: 'directory',
        status: 'different',
        children: [file('app.ts', 'src/app.ts'), file('util.ts', 'src/util.ts')]
      },
      file('README.md', 'README.md')
    ]
  }
}

describe('visibleForNameFilter', () => {
  it('returns matching files plus their ancestor dirs', () => {
    const v = visibleForNameFilter(tree(), 'app')
    expect(v.has('src/app.ts')).toBe(true)
    expect(v.has('src')).toBe(true) // ancestor kept
    expect(v.has('src/util.ts')).toBe(false)
    expect(v.has('README.md')).toBe(false)
    expect(v.has('')).toBe(false) // root never included
  })

  it('is case-insensitive and trims', () => {
    expect(visibleForNameFilter(tree(), '  README  ').has('README.md')).toBe(true)
    expect(visibleForNameFilter(tree(), 'readme').has('README.md')).toBe(true)
  })

  it('returns an empty set for an empty query', () => {
    expect(visibleForNameFilter(tree(), '   ').size).toBe(0)
  })
})

describe('flatten with a name filter', () => {
  it('shows only matching files and their (force-expanded) ancestor dirs', () => {
    const rows = flatten(tree(), new Set(), false, 'util')
    const paths = rows.map((r) => r.node.relPath)
    expect(paths).toEqual(['src', 'src/util.ts'])
    // The src dir is force-open even though `expanded` was empty.
    expect(rows.find((r) => r.node.relPath === 'src')?.expanded).toBe(true)
  })

  it('behaves like before when the filter is empty', () => {
    const expanded = new Set(['src'])
    const paths = flatten(tree(), expanded, false, '').map((r) => r.node.relPath)
    expect(paths).toEqual(['src', 'src/app.ts', 'src/util.ts', 'README.md'])
  })

  it('respects hideIdentical alongside the filter', () => {
    const t = tree()
    t.children![0].children![0].status = 'identical' // src/app.ts identical
    const paths = flatten(t, new Set(), true, 'ts').map((r) => r.node.relPath)
    expect(paths).toEqual(['src', 'src/util.ts'])
  })
})
