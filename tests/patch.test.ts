import { describe, expect, it } from 'vitest'
import { toUnifiedDiff } from '../src/shared/blocks'
import { applyUnifiedDiff, parseUnifiedDiff } from '../src/shared/patch'

/** Applying a generated patch to the old text must reproduce the new text. */
function expectRoundTrip(left: string, right: string): void {
  const patch = toUnifiedDiff(left, right)
  expect(patch).not.toBe('') // these fixtures differ
  const result = applyUnifiedDiff(left, patch)
  expect(result).not.toBeNull()
  expect(result!.failed).toBe(0)
  expect(result!.text).toBe(right)
}

describe('applyUnifiedDiff — round-trips with toUnifiedDiff', () => {
  it('single changed line', () => {
    expectRoundTrip('a\nb\nc\nd\ne', 'a\nB\nc\nd\ne')
  })

  it('multiple separated hunks', () => {
    const left = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n')
    const right = left
      .split('\n')
      .map((l, i) => (i === 2 ? 'CHANGED 2' : i === 15 ? 'CHANGED 15' : l))
      .join('\n')
    const patch = toUnifiedDiff(left, right)
    expect(parseUnifiedDiff(patch)!.length).toBe(2) // two hunks
    expectRoundTrip(left, right)
  })

  it('pure insertions and deletions', () => {
    expectRoundTrip('a\nb\nc', 'a\nx\ny\nb\nc') // insert
    expectRoundTrip('a\nb\nc\nd', 'a\nd') // delete
  })

  it('content added to an empty document', () => {
    expectRoundTrip('', 'first\nsecond')
  })

  it('text with a trailing newline', () => {
    expectRoundTrip('a\nb\n', 'a\nB\n')
  })
})

describe('parseUnifiedDiff', () => {
  it('returns null when there are no hunks', () => {
    expect(parseUnifiedDiff('not a patch at all')).toBeNull()
    expect(parseUnifiedDiff('')).toBeNull()
  })

  it('reads hunk headers with and without explicit lengths', () => {
    const hunks = parseUnifiedDiff('@@ -1 +1 @@\n-a\n+b')
    expect(hunks).not.toBeNull()
    expect(hunks![0]).toMatchObject({ oldStart: 1, oldLen: 1, newStart: 1, newLen: 1 })
  })
})

describe('applyUnifiedDiff — resilience', () => {
  it('reports a hunk that cannot be located instead of corrupting output', () => {
    // Patch expects "zzz" as context/removed, which isn't in the source.
    const patch = '@@ -1,2 +1,2 @@\n zzz\n-old\n+new'
    const result = applyUnifiedDiff('completely\ndifferent\ntext', patch)
    expect(result).not.toBeNull()
    expect(result!.failed).toBe(1)
    expect(result!.applied).toBe(0)
    expect(result!.text).toBe('completely\ndifferent\ntext') // unchanged
  })

  it('relocates a hunk whose line numbers have drifted', () => {
    // Prepend lines so the real change sits below the header's oldStart.
    const left = 'pre1\npre2\npre3\na\nb\nc'
    const patch = toUnifiedDiff('a\nb\nc', 'a\nB\nc') // headers reference line ~2
    const result = applyUnifiedDiff(left, patch)
    expect(result!.failed).toBe(0)
    expect(result!.text).toBe('pre1\npre2\npre3\na\nB\nc')
  })
})
