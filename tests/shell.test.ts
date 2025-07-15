import { describe, expect, it } from 'vitest'
import { parseCompareWith, parseSelectLeft } from '../src/shared/shell'

describe('parseSelectLeft / parseCompareWith', () => {
  it('reads the path after each flag', () => {
    expect(parseSelectLeft(['app', '--juxta-select', 'C:\\a\\b.txt'])).toBe('C:\\a\\b.txt')
    expect(parseCompareWith(['app', '--juxta-compare', 'C:\\a\\c.txt'])).toBe('C:\\a\\c.txt')
  })

  it('returns null when the flag is absent or has no value', () => {
    expect(parseSelectLeft(['app', 'x'])).toBeNull()
    expect(parseCompareWith(['app', '--juxta-compare'])).toBeNull()
    expect(parseSelectLeft(['app', '--juxta-select', ''])).toBeNull()
  })
})
