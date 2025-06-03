import { describe, expect, it } from 'vitest'
import { applyBlock, blockAtRightLine, changedBlockIndices, computeBlocks } from '../src/shared/blocks'

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

describe('blockAtRightLine', () => {
  it('maps a right-side line number to its changed block', () => {
    // left: a B c   right: a X Y c   -> changed block at right lines 2..3
    const blocks = computeBlocks('a\nB\nc', 'a\nX\nY\nc')
    const idx = blockAtRightLine(blocks, 2)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(blocks[idx].changed).toBe(true)
  })
})
