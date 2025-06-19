import { describe, expect, it } from 'vitest'
import { compareFolders } from '../src/core/compare'
import { planSync, planTimestamp, type MergeAction } from '../src/shared/sync'
import type { CompareNode } from '../src/shared/types'
import { DEFAULT_FILTERS, type CompareOptions } from '../src/shared/types'
import { makeTree } from './helpers'

const options: CompareOptions = { method: 'content', filters: { ...DEFAULT_FILTERS, excludeGlobs: [] } }
const byRel = (actions: MergeAction[]): Map<string, MergeAction> =>
  new Map(actions.map((a) => [a.relPath, a]))

// left newer 'diff.txt', a left-only and a right-only file.
async function scenario(): Promise<{ left: string; right: string }> {
  const left = await makeTree({
    'diff.txt': { content: 'LEFT', mtime: 2_000_000_000_000 },
    'lonly.txt': 'x'
  })
  const right = await makeTree({
    'diff.txt': { content: 'RIGHTER', mtime: 1_000_000_000_000 },
    'ronly.txt': 'y'
  })
  return { left, right }
}

describe('planTimestamp', () => {
  const node: CompareNode = {
    name: 'f.txt',
    relPath: 'f.txt',
    kind: 'file',
    status: 'different',
    left: { path: '/l/f.txt', size: 1, mtimeMs: 5000 },
    right: { path: '/r/f.txt', size: 1, mtimeMs: 9000 }
  }
  it('copies the source mtime onto the other side', () => {
    expect(planTimestamp(node, 'left')).toEqual({ path: '/r/f.txt', mtimeMs: 5000 })
    expect(planTimestamp(node, 'right')).toEqual({ path: '/l/f.txt', mtimeMs: 9000 })
  })
  it('returns null when one side is missing', () => {
    expect(planTimestamp({ ...node, right: undefined }, 'left')).toBeNull()
  })
})

describe('planSync — mirror', () => {
  it('copies source diffs/orphans and deletes destination-only', async () => {
    const { left, right } = await scenario()
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options })
    const { actions, conflicts } = planSync(res.root, left, right, { mode: 'mirror', direction: 'left' })
    const m = byRel(actions)
    expect(m.get('diff.txt')!.kind).toBe('copy')
    expect(m.get('lonly.txt')!.kind).toBe('copy')
    expect(m.get('ronly.txt')!.kind).toBe('delete')
    expect(conflicts).toEqual([])
  })
})

describe('planSync — update', () => {
  it('copies newer/only source files and never deletes', async () => {
    const { left, right } = await scenario()
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options })
    const { actions } = planSync(res.root, left, right, { mode: 'update', direction: 'left' })
    const m = byRel(actions)
    expect(m.get('diff.txt')!.kind).toBe('copy') // left is newer
    expect(m.get('lonly.txt')!.kind).toBe('copy')
    expect(m.has('ronly.txt')).toBe(false) // no deletes in update
  })
})

describe('planSync — two-way', () => {
  it('copies each side toward the other (newer wins)', async () => {
    const { left, right } = await scenario()
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options })
    const { actions, conflicts } = planSync(res.root, left, right, { mode: 'twoWay' })
    const m = byRel(actions)
    expect(m.get('diff.txt')!.srcPath!.startsWith(left)).toBe(true) // left newer -> L→R
    expect(m.get('lonly.txt')!.srcPath!.startsWith(left)).toBe(true)
    expect(m.get('ronly.txt')!.srcPath!.startsWith(right)).toBe(true) // R→L
    expect(actions.every((a) => a.kind === 'copy')).toBe(true)
    expect(conflicts).toEqual([])
  })

  it('reports a conflict when both sides changed with the same mtime', async () => {
    const left = await makeTree({ 'c.txt': { content: 'AAAA', mtime: 1_000_000_000_000 } })
    const right = await makeTree({ 'c.txt': { content: 'BBBB', mtime: 1_000_000_000_000 } })
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options })
    const { actions, conflicts } = planSync(res.root, left, right, { mode: 'twoWay' })
    expect(conflicts).toEqual(['c.txt'])
    expect(actions).toEqual([])
  })
})
