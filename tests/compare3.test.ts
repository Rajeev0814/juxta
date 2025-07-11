import { describe, expect, it } from 'vitest'
import { compareFolders3, threeWayStatus } from '../src/core/compare3'
import { DEFAULT_OPTIONS } from '../src/shared/types'
import type { ThreeWayNode } from '../src/shared/types'
import { makeTree } from './helpers'

describe('threeWayStatus', () => {
  it('classifies the present-on-all-sides cases', () => {
    expect(threeWayStatus('h', 'h', 'h')).toBe('unchanged')
    expect(threeWayStatus('h', 'x', 'h')).toBe('modifiedLeft')
    expect(threeWayStatus('h', 'h', 'x')).toBe('modifiedRight')
    expect(threeWayStatus('h', 'x', 'x')).toBe('modifiedBoth')
    expect(threeWayStatus('h', 'x', 'y')).toBe('conflict')
  })

  it('classifies deletions (and change-vs-delete conflicts)', () => {
    expect(threeWayStatus('h', 'h', undefined)).toBe('deletedRight')
    expect(threeWayStatus('h', undefined, 'h')).toBe('deletedLeft')
    expect(threeWayStatus('h', undefined, undefined)).toBe('deletedBoth')
    expect(threeWayStatus('h', 'x', undefined)).toBe('conflict') // left changed, right deleted
    expect(threeWayStatus('h', undefined, 'x')).toBe('conflict')
  })

  it('classifies additions', () => {
    expect(threeWayStatus(undefined, 'a', undefined)).toBe('addedLeft')
    expect(threeWayStatus(undefined, undefined, 'b')).toBe('addedRight')
    expect(threeWayStatus(undefined, 'a', 'a')).toBe('addedBoth')
    expect(threeWayStatus(undefined, 'a', 'b')).toBe('conflict')
  })
})

describe('compareFolders3', () => {
  it('classifies a full base/left/right scenario', async () => {
    const base = await makeTree({ common: '1', modL: '1', modR: '1', conflict: '1', delR: '1' })
    const left = await makeTree({
      common: '1',
      modL: '2',
      modR: '1',
      conflict: 'L',
      delR: '1',
      addL: 'x',
      addBoth: 'a'
    })
    const right = await makeTree({ common: '1', modL: '1', modR: '2', conflict: 'R', addBoth: 'b' })

    const res = await compareFolders3({ baseRoot: base, leftRoot: left, rightRoot: right, options: DEFAULT_OPTIONS })

    const byPath = new Map<string, ThreeWayNode>()
    const visit = (n: ThreeWayNode): void => {
      if (n.kind === 'file') byPath.set(n.relPath, n)
      n.children?.forEach(visit)
    }
    visit(res.root)

    expect(byPath.get('common')!.status).toBe('unchanged')
    expect(byPath.get('modL')!.status).toBe('modifiedLeft')
    expect(byPath.get('modR')!.status).toBe('modifiedRight')
    expect(byPath.get('conflict')!.status).toBe('conflict')
    expect(byPath.get('delR')!.status).toBe('deletedRight')
    expect(byPath.get('addL')!.status).toBe('addedLeft')
    expect(byPath.get('addBoth')!.status).toBe('conflict') // added differently on both sides

    expect(res.summary).toEqual({
      unchanged: 1,
      modified: 2,
      added: 1,
      deleted: 1,
      conflicts: 2,
      totalFiles: 7
    })
  })
})
