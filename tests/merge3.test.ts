import { describe, expect, it } from 'vitest'
import { merge3 } from '../src/shared/merge3'

describe('merge3', () => {
  it('auto-merges non-overlapping changes on each side', () => {
    const base = 'a\nb\nc'
    const local = 'A\nb\nc' // changed line 1
    const remote = 'a\nb\nC' // changed line 3
    const r = merge3(base, local, remote)
    expect(r.conflicts).toBe(0)
    expect(r.merged).toBe('A\nb\nC')
  })

  it('takes the changed side when only one side changed', () => {
    expect(merge3('a\nb\nc', 'a\nb\nc', 'a\nX\nc').merged).toBe('a\nX\nc')
    expect(merge3('a\nb\nc', 'a\nX\nc', 'a\nb\nc').merged).toBe('a\nX\nc')
  })

  it('returns base unchanged when neither side changed', () => {
    const r = merge3('a\nb\nc', 'a\nb\nc', 'a\nb\nc')
    expect(r.conflicts).toBe(0)
    expect(r.merged).toBe('a\nb\nc')
  })

  it('merges identical changes from both sides without conflict', () => {
    const r = merge3('a\nb\nc', 'a\nX\nc', 'a\nX\nc')
    expect(r.conflicts).toBe(0)
    expect(r.merged).toBe('a\nX\nc')
  })

  it('produces a conflict when both sides change the same region differently', () => {
    const r = merge3('a\nb\nc', 'a\nL\nc', 'a\nR\nc', { localLabel: 'MINE', remoteLabel: 'THEIRS' })
    expect(r.conflicts).toBe(1)
    expect(r.merged).toBe('a\n<<<<<<< MINE\nL\n=======\nR\n>>>>>>> THEIRS\nc')
  })

  it('merges independent insertions at different positions', () => {
    const base = 'a\nb\nc'
    const local = 'start\na\nb\nc' // insert at top
    const remote = 'a\nb\nc\nend' // insert at bottom
    const r = merge3(base, local, remote)
    expect(r.conflicts).toBe(0)
    expect(r.merged).toBe('start\na\nb\nc\nend')
  })

  it('takes a deletion made on one side only', () => {
    const r = merge3('a\nb\nc', 'a\nc', 'a\nb\nc') // local deleted b
    expect(r.conflicts).toBe(0)
    expect(r.merged).toBe('a\nc')
  })
})
