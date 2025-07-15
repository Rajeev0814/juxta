import { describe, expect, it } from 'vitest'
import { canonicalizeCode } from '../src/core/code'
import { isCodePath } from '../src/shared/jsast'

describe('isCodePath', () => {
  it('covers the JS/TS family', () => {
    for (const ext of ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx']) {
      expect(isCodePath(`a.${ext}`)).toBe(true)
    }
    expect(isCodePath('a.py')).toBe(false)
    expect(isCodePath('a.txt')).toBe(false)
  })
})

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

  it('parses TypeScript, ignoring comments/formatting but catching type changes', () => {
    const a = canonicalizeCode('const x: number = 1 // c', 'a.ts')
    const b = canonicalizeCode('const  x : number=1;', 'a.ts')
    expect(a).not.toBeNull()
    expect(a).toBe(b)
    expect(canonicalizeCode('let x: number', 'a.ts')).not.toBe(canonicalizeCode('let x: string', 'a.ts'))
  })

  it('parses TSX and JSX', () => {
    expect(canonicalizeCode('const e = <div a={x}>{y}</div>', 'a.tsx')).not.toBeNull()
    expect(canonicalizeCode('const e = <App a={1}/>', 'a.jsx')).not.toBeNull()
    // A TS-only construct fails under the plain-JS parser but parses as .ts
    expect(canonicalizeCode('interface I { a: number }', 'a.js')).toBeNull()
    expect(canonicalizeCode('interface I { a: number }', 'a.ts')).not.toBeNull()
  })
})
