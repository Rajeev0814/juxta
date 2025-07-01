import { describe, expect, it } from 'vitest'
import { canonicalizeYaml } from '../src/core/yaml'

describe('canonicalizeYaml', () => {
  it('ignores formatting and mapping key order', () => {
    const a = canonicalizeYaml('b: 1\na: 2\n')
    const b = canonicalizeYaml('a: 2\nb: 1\n')
    expect(a).toBe(b)
    expect(a).toBe('{"a":2,"b":1}')
  })

  it('sorts keys recursively and matches the JSON canonical form', () => {
    expect(canonicalizeYaml('z:\n  y: 1\n  x: 2\n')).toBe('{"z":{"x":2,"y":1}}')
  })

  it('treats quoting/flow style as equivalent', () => {
    expect(canonicalizeYaml('name: "juxta"\n')).toBe(canonicalizeYaml('{ name: juxta }'))
  })

  it('preserves sequence order (significant)', () => {
    expect(canonicalizeYaml('- 1\n- 2\n- 3\n')).not.toBe(canonicalizeYaml('- 3\n- 2\n- 1\n'))
  })

  it('canonicalizes multiple documents', () => {
    expect(canonicalizeYaml('a: 1\n---\nb: 2\n')).toBe('{"a":1}\n---\n{"b":2}')
  })

  it('returns null for invalid YAML', () => {
    expect(canonicalizeYaml('a: [1, 2\n')).toBeNull()
    expect(canonicalizeYaml('')).toBeNull()
  })
})
