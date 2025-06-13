import { describe, expect, it } from 'vitest'
import {
  applyBlock,
  blockAtRightLine,
  changedBlockIndices,
  computeBlocks,
  diffStats,
  toUnifiedDiff
} from '../src/shared/blocks'

describe('computeBlocks', () => {
  it('produces equal/changed/equal for a single-line modification', () => {
    const blocks = computeBlocks('a\nB\nc', 'a\nX\nc')
    expect(blocks.map((b) => b.changed)).toEqual([false, true, false])
    expect(blocks[1].left).toEqual(['B'])
    expect(blocks[1].right).toEqual(['X'])
    expect(blocks[1].leftStart).toBe(2)
    expect(blocks[1].rightStart).toBe(2)
  })

  it('models an insertion (right has an extra line)', () => {
    const blocks = computeBlocks('a\nc', 'a\nb\nc')
    const changed = blocks.find((b) => b.changed)!
    expect(changed.left).toEqual([])
    expect(changed.right).toEqual(['b'])
  })

  it('models a deletion (left has an extra line)', () => {
    const blocks = computeBlocks('a\nb\nc', 'a\nc')
    const changed = blocks.find((b) => b.changed)!
    expect(changed.left).toEqual(['b'])
    expect(changed.right).toEqual([])
  })

  it('reports no changed blocks for identical text', () => {
    expect(changedBlockIndices(computeBlocks('x\ny', 'x\ny'))).toEqual([])
  })
})

describe('applyBlock', () => {
  it('copies a modified block left -> right', () => {
    const blocks = computeBlocks('a\nB\nc', 'a\nX\nc')
    const { right } = applyBlock(blocks, 1, 'toRight')
    expect(right).toBe('a\nB\nc')
  })

  it('copies a modified block right -> left', () => {
    const blocks = computeBlocks('a\nB\nc', 'a\nX\nc')
    const { left } = applyBlock(blocks, 1, 'toLeft')
    expect(left).toBe('a\nX\nc')
  })

  it('applies an insertion onto the left (accept the new line)', () => {
    const blocks = computeBlocks('a\nc', 'a\nb\nc')
    const idx = changedBlockIndices(blocks)[0]
    const { left } = applyBlock(blocks, idx, 'toLeft')
    expect(left).toBe('a\nb\nc')
  })

  it('removes an inserted line by copying the (empty) left block onto the right', () => {
    const blocks = computeBlocks('a\nc', 'a\nb\nc')
    const idx = changedBlockIndices(blocks)[0]
    const { right } = applyBlock(blocks, idx, 'toRight')
    expect(right).toBe('a\nc')
  })
})

describe('diffStats', () => {
  it('counts a modification as one added and one removed', () => {
    expect(diffStats('a\nB\nc', 'a\nX\nc')).toEqual({ added: 1, removed: 1 })
  })
  it('counts a pure insertion', () => {
    expect(diffStats('a\nc', 'a\nb\nc')).toEqual({ added: 1, removed: 0 })
  })
  it('counts a pure deletion', () => {
    expect(diffStats('a\nb\nc', 'a\nc')).toEqual({ added: 0, removed: 1 })
  })
  it('is zero for identical text', () => {
    expect(diffStats('x\ny', 'x\ny')).toEqual({ added: 0, removed: 0 })
  })
})

describe('toUnifiedDiff', () => {
  it('returns empty string for identical text', () => {
    expect(toUnifiedDiff('a\nb\nc', 'a\nb\nc')).toBe('')
  })

  it('emits a header and a hunk for a single-line modification', () => {
    const patch = toUnifiedDiff('a\nB\nc', 'a\nX\nc', { oldPath: 'old.txt', newPath: 'new.txt', context: 1 })
    const lines = patch.split('\n')
    expect(lines[0]).toBe('--- old.txt')
    expect(lines[1]).toBe('+++ new.txt')
    expect(lines[2]).toBe('@@ -1,3 +1,3 @@')
    expect(lines).toContain(' a')
    expect(lines).toContain('-B')
    expect(lines).toContain('+X')
    expect(lines).toContain(' c')
  })

  it('represents an insertion (+ line, no - line)', () => {
    const patch = toUnifiedDiff('a\nc', 'a\nb\nc', { context: 3 })
    expect(patch).toContain('+b')
    // no deletion body lines (ignore the '---' file header)
    const deletions = patch.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---'))
    expect(deletions).toHaveLength(0)
    // old has 2 lines, new has 3
    expect(patch).toContain('@@ -1,2 +1,3 @@')
  })

  it('represents a deletion (- line, no + line)', () => {
    const patch = toUnifiedDiff('a\nb\nc', 'a\nc', { context: 3 })
    expect(patch).toContain('-b')
    expect(patch).toContain('@@ -1,3 +1,2 @@')
  })

  it('produces two separate hunks for distant changes with small context', () => {
    const left = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9'].join('\n')
    const right = ['l1', 'X', 'l3', 'l4', 'l5', 'l6', 'l7', 'Y', 'l9'].join('\n')
    const patch = toUnifiedDiff(left, right, { context: 1 })
    const hunkCount = (patch.match(/^@@ /gm) ?? []).length
    expect(hunkCount).toBe(2)
  })

  it('merges nearby changes into a single hunk', () => {
    const left = ['l1', 'l2', 'l3', 'l4', 'l5'].join('\n')
    const right = ['l1', 'X', 'l3', 'Y', 'l5'].join('\n')
    const patch = toUnifiedDiff(left, right, { context: 3 })
    expect((patch.match(/^@@ /gm) ?? []).length).toBe(1)
  })
})

describe('blockAtRightLine', () => {
  it('maps a right-side line number to its changed block', () => {
    // left: a B c   right: a X Y c   -> changed block at right lines 2..3
    const blocks = computeBlocks('a\nB\nc', 'a\nX\nY\nc')
    const idx = blockAtRightLine(blocks, 2)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(blocks[idx].changed).toBe(true)
  })
})
