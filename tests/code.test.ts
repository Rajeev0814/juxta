import { describe, expect, it } from 'vitest'
import { canonicalizeCode } from '../src/core/code'

describe('canonicalizeCode', () => {
  it('ignores comments, whitespace, semicolons and quote style', () => {
    const a = canonicalizeCode(`// header\nconst x = "hi"\nfunction f(a){return a+1}`)
    const b = canonicalizeCode(`const x = 'hi';\n\n/* other */\nfunction f(a) {\n  return a + 1\n}`)
    expect(a).not.toBeNull()
    expect(a).toBe(b)
  })

  it('treats equivalent numeric literals the same (raw dropped)', () => {
    expect(canonicalizeCode('const n = 1.0')).toBe(canonicalizeCode('const n = 1'))
  })

  it('distinguishes real logic differences', () => {
    expect(canonicalizeCode('const x = 1')).not.toBe(canonicalizeCode('const x = 2'))
    expect(canonicalizeCode('f(a, b)')).not.toBe(canonicalizeCode('f(b, a)'))
  })

  it('parses modern module syntax', () => {
    expect(canonicalizeCode('export const x = () => 42')).not.toBeNull()
  })

  it('returns null for unparseable source', () => {
    expect(canonicalizeCode('function (')).toBeNull()
  })
})
