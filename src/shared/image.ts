// Image comparison helpers. isImagePath is renderer-safe; pixelDiff is a pure
// RGBA comparison so it can be unit-tested without a browser/canvas.

const IMAGE_RE = /\.(png|jpe?g|gif|bmp|webp|ico|avif)$/i

export function isImagePath(p: string): boolean {
  return IMAGE_RE.test(p)
}

export interface PixelDiffResult {
  diffPixels: number
  totalPixels: number
  /** RGBA mask: opaque red where pixels differ, transparent where they match. */
  mask: Uint8ClampedArray
}

/**
 * Compare two equal-length RGBA buffers. A pixel counts as different if any
 * channel differs by more than `threshold` (0–255). Produces a red-on-transparent
 * mask for a difference overlay.
 */
export function pixelDiff(a: Uint8ClampedArray, b: Uint8ClampedArray, threshold = 0): PixelDiffResult {
  const len = Math.min(a.length, b.length)
  const mask = new Uint8ClampedArray(len)
  let diffPixels = 0
  for (let i = 0; i < len; i += 4) {
    const differs =
      Math.abs(a[i] - b[i]) > threshold ||
      Math.abs(a[i + 1] - b[i + 1]) > threshold ||
      Math.abs(a[i + 2] - b[i + 2]) > threshold ||
      Math.abs(a[i + 3] - b[i + 3]) > threshold
    if (differs) {
      diffPixels++
      mask[i] = 255
      mask[i + 1] = 0
      mask[i + 2] = 0
      mask[i + 3] = 255
    } // else leave transparent (all zero)
  }
  return { diffPixels, totalPixels: len / 4, mask }
}
