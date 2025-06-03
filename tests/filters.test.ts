import { describe, expect, it } from 'vitest'
import { createMatcher, createWalkMatcher, normalizeGlob } from '../src/core/filters'
import { DEFAULT_FILTERS, type FilterOptions } from '../src/shared/types'

function filters(patch: Partial<FilterOptions>): FilterOptions {
  return { ...DEFAULT_FILTERS, excludeGlobs: [], ...patch }
}

describe('normalizeGlob', () => {
  it('expands a trailing-slash directory shorthand to match anywhere', () => {
    const out = normalizeGlob('node_modules/')
    expect(out).toContain('**/node_modules')
    expect(out).toContain('**/node_modules/**')
  })

  it('expands a bare extension glob to match at any depth', () => {
    const out = normalizeGlob('*.log')
    expect(out).toContain('*.log')
    expect(out).toContain('**/*.log')
  })

  it('leaves explicit path globs alone', () => {
    expect(normalizeGlob('src/**/*.ts')).toEqual(['src/**/*.ts'])
  })
})

describe('createMatcher (file-level)', () => {
  it('excludes paths matching an exclude glob', () => {
    const m = createMatcher(filters({ excludeGlobs: ['*.log'] }))
    expect(m.shouldInclude('app.log', false)).toBe(false)
    expect(m.shouldInclude('logs/app.log', false)).toBe(false)
    expect(m.shouldInclude('app.ts', false)).toBe(true)
  })

  it('keeps only files matching an include glob', () => {
    const m = createMatcher(filters({ includeGlobs: ['*.ts'] }))
    expect(m.shouldInclude('a.ts', false)).toBe(true)
    expect(m.shouldInclude('a.js', false)).toBe(false)
  })

  it('excludes win over includes', () => {
    const m = createMatcher(filters({ includeGlobs: ['*.ts'], excludeGlobs: ['secret.ts'] }))
    expect(m.shouldInclude('secret.ts', false)).toBe(false)
    expect(m.shouldInclude('ok.ts', false)).toBe(true)
  })
})

describe('createWalkMatcher (directory-aware)', () => {
  it('always descends into directories even with an include filter', () => {
    const m = createWalkMatcher(filters({ includeGlobs: ['*.ts'] }))
    expect(m.shouldInclude('src', true)).toBe(true)
    expect(m.shouldInclude('src/a.js', false)).toBe(false)
    expect(m.shouldInclude('src/a.ts', false)).toBe(true)
  })

  it('still prunes excluded directories', () => {
    const m = createWalkMatcher(filters({ excludeGlobs: ['node_modules/'] }))
    expect(m.shouldInclude('node_modules', true)).toBe(false)
    expect(m.shouldInclude('src/node_modules', true)).toBe(false)
  })
})
