import { describe, expect, it } from 'vitest'
import { canonicalizeJson } from '../src/core/json'

describe('canonicalizeJson', () => {
  it('ignores whitespace and object key order', () => {
    const a = canonicalizeJson('{ "b": 1, "a": 2 }')
    const b = canonicalizeJson('{\n  "a": 2,\n  "b": 1\n}')
    expect(a).toBe(b)
    expect(a).toBe('{"a":2,"b":1}')
  })

  it('sorts keys recursively', () => {
    expect(canonicalizeJson('{"z":{"y":1,"x":2}}')).toBe('{"z":{"x":2,"y":1}}')
  })

  it('preserves array order (significant)', () => {
    expect(canonicalizeJson('[1,2,3]')).not.toBe(canonicalizeJson('[3,2,1]'))
  })

  it('returns null for invalid JSON', () => {
    expect(canonicalizeJson('{not json}')).toBeNull()
    expect(canonicalizeJson('')).toBeNull()
  })
})
