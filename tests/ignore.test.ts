import { describe, expect, it } from 'vitest'
import { createIgnoreMatcher, parseIgnore } from '../src/core/ignore'

const SAMPLE = `
# a comment

*.log
build/
/only-root.txt
node_modules/
!keep.log
`

describe('parseIgnore', () => {
  it('skips blank lines and comments', () => {
    expect(parseIgnore(SAMPLE)).toHaveLength(5)
  })
})

describe('createIgnoreMatcher', () => {
  const m = createIgnoreMatcher(SAMPLE)

  it('ignores an extension pattern at any depth', () => {
    expect(m.ignores('a.log', false)).toBe(true)
    expect(m.ignores('sub/deep/a.log', false)).toBe(true)
  })

  it('honors negation (last match wins)', () => {
    expect(m.ignores('keep.log', false)).toBe(false)
  })

  it('directory-only rule ignores the dir + contents, not a like-named file', () => {
    expect(m.ignores('build', true)).toBe(true)
    expect(m.ignores('build', false)).toBe(false) // a *file* named build
    expect(m.ignores('build/out.js', false)).toBe(true)
  })

  it('ignores nested node_modules contents anywhere', () => {
    expect(m.ignores('pkg/node_modules/dep/index.js', false)).toBe(true)
  })

  it('anchored rule only matches at the root', () => {
    expect(m.ignores('only-root.txt', false)).toBe(true)
    expect(m.ignores('sub/only-root.txt', false)).toBe(false)
  })

  it('does not ignore unrelated files', () => {
    expect(m.ignores('src/app.ts', false)).toBe(false)
  })
})
