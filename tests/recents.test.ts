import { describe, expect, it } from 'vitest'
import { addRecent, type RecentComparison } from '../src/shared/session'

const f = (left: string, right: string): RecentComparison => ({ type: 'folders', left, right })

describe('addRecent', () => {
  it('prepends the newest entry', () => {
    const out = addRecent([f('a', 'b')], f('c', 'd'))
    expect(out.map((r) => r.left)).toEqual(['c', 'a'])
  })

  it('moves an existing entry to the front instead of duplicating', () => {
    const out = addRecent([f('a', 'b'), f('c', 'd')], f('a', 'b'))
    expect(out).toEqual([f('a', 'b'), f('c', 'd')])
  })

  it('distinguishes entries by type', () => {
    const out = addRecent([{ type: 'folders', left: 'a', right: 'b' }], { type: 'files', left: 'a', right: 'b' })
    expect(out).toHaveLength(2)
  })

  it('caps the list at the max length', () => {
    let list: RecentComparison[] = []
    for (let i = 0; i < 15; i++) list = addRecent(list, f(`L${i}`, `R${i}`), 10)
    expect(list).toHaveLength(10)
    expect(list[0].left).toBe('L14') // newest first
    expect(list[9].left).toBe('L5') // oldest kept
  })

  it('ignores entries missing a side', () => {
    expect(addRecent([], f('', 'b'))).toEqual([])
    expect(addRecent([f('a', 'b')], f('c', ''))).toEqual([f('a', 'b')])
  })
})
