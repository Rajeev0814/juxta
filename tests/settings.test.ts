import { describe, expect, it } from 'vitest'
import { coerceSettings, DEFAULT_SETTINGS } from '../src/shared/settings'

describe('coerceSettings', () => {
  it('returns defaults for non-object / garbage input', () => {
    expect(coerceSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(coerceSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(coerceSettings(42)).toEqual(DEFAULT_SETTINGS)
    expect(coerceSettings('nope')).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid fields and falls back for missing ones', () => {
    const s = coerceSettings({ leftRoot: 'C:/a', theme: 'light', mode: 'files', hideIdentical: true })
    expect(s.leftRoot).toBe('C:/a')
    expect(s.theme).toBe('light')
    expect(s.mode).toBe('files')
    expect(s.hideIdentical).toBe(true)
    // untouched fields keep defaults
    expect(s.rightRoot).toBe('')
    expect(s.useTrash).toBe(true)
    expect(s.options.method).toBe('content')
  })

  it('rejects invalid enum values', () => {
    const s = coerceSettings({ theme: 'neon', mode: 'galaxy', options: { method: 'telepathy' } })
    expect(s.theme).toBe('dark')
    expect(s.mode).toBe('folders')
    expect(s.options.method).toBe('content')
  })

  it('coerces filter sub-fields and ignores non-string globs', () => {
    const s = coerceSettings({
      options: { method: 'quick', filters: { includeGlobs: ['*.ts', 5], excludeGlobs: ['x'], ignoreCase: true } }
    })
    expect(s.options.method).toBe('quick')
    // includeGlobs had a non-string -> falls back to default ([])
    expect(s.options.filters.includeGlobs).toEqual([])
    expect(s.options.filters.excludeGlobs).toEqual(['x'])
    expect(s.options.filters.ignoreCase).toBe(true)
  })

  it('accepts valid window bounds and rejects malformed ones', () => {
    expect(coerceSettings({ windowBounds: { x: 10, y: 20, width: 800, height: 600 } }).windowBounds).toEqual({
      x: 10,
      y: 20,
      width: 800,
      height: 600
    })
    expect(coerceSettings({ windowBounds: { x: 10, y: 20, width: 0, height: 600 } }).windowBounds).toBeNull()
    expect(coerceSettings({ windowBounds: 'big' }).windowBounds).toBeNull()
  })
})
