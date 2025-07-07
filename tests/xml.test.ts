import { describe, expect, it } from 'vitest'
import { canonicalizeXml } from '../src/core/xml'

describe('canonicalizeXml', () => {
  it('ignores indentation and insignificant whitespace', () => {
    const a = canonicalizeXml('<root><a>1</a><b>2</b></root>')
    const b = canonicalizeXml('<root>\n  <a>1</a>\n  <b>2</b>\n</root>')
    expect(a).toBe(b)
  })

  it('ignores attribute order', () => {
    const a = canonicalizeXml('<node x="1" y="2"/>')
    const b = canonicalizeXml('<node y="2" x="1"/>')
    expect(a).toBe(b)
  })

  it('detects real content differences', () => {
    expect(canonicalizeXml('<a>1</a>')).not.toBe(canonicalizeXml('<a>2</a>'))
    expect(canonicalizeXml('<node x="1"/>')).not.toBe(canonicalizeXml('<node x="9"/>'))
  })

  it('returns null for malformed XML', () => {
    expect(canonicalizeXml('<a><b></a>')).toBeNull()
    expect(canonicalizeXml('not xml at all <')).toBeNull()
  })
})
