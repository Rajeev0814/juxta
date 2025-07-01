import { describe, expect, it } from 'vitest'
import { isImagePath, pixelDiff } from '../src/shared/image'

describe('isImagePath', () => {
  it('recognizes common image extensions', () => {
    expect(isImagePath('a.png')).toBe(true)
    expect(isImagePath('b.JPG')).toBe(true)
    expect(isImagePath('c.webp')).toBe(true)
    expect(isImagePath('d.txt')).toBe(false)
  })
})

describe('pixelDiff', () => {
  const rgba = (...px: number[][]): Uint8ClampedArray => Uint8ClampedArray.from(px.flat())

  it('counts differing pixels and marks them red', () => {
    // pixel 0 identical (black), pixel 1 differs (white vs black)
    const a = rgba([0, 0, 0, 255], [255, 255, 255, 255])
    const b = rgba([0, 0, 0, 255], [0, 0, 0, 255])
    const r = pixelDiff(a, b)
    expect(r.diffPixels).toBe(1)
    expect(r.totalPixels).toBe(2)
    // pixel 0 mask transparent, pixel 1 mask opaque red
    expect([...r.mask.slice(0, 4)]).toEqual([0, 0, 0, 0])
    expect([...r.mask.slice(4, 8)]).toEqual([255, 0, 0, 255])
  })

  it('reports zero diff for identical buffers', () => {
    const a = rgba([10, 20, 30, 255])
    expect(pixelDiff(a, Uint8ClampedArray.from(a)).diffPixels).toBe(0)
  })

  it('honors the threshold (small channel deltas ignored)', () => {
    const a = rgba([100, 100, 100, 255])
    const b = rgba([103, 100, 100, 255])
    expect(pixelDiff(a, b, 0).diffPixels).toBe(1)
    expect(pixelDiff(a, b, 5).diffPixels).toBe(0)
  })
})
