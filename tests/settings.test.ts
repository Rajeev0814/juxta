import { describe, expect, it } from 'vitest'
import { coerceSettings } from '../src/shared/settings'

describe('coerceSettings', () => {
  it('returns a default single folder session for garbage input', () => {
    for (const bad of [undefined, null, 42, 'nope']) {
      const s = coerceSettings(bad)
      expect(s.sessions).toHaveLength(1)
      expect(s.sessions[0].type).toBe('folders')
      expect(s.activeSessionId).toBe(s.sessions[0].id)
      expect(s.theme).toBe('dark')
      expect(s.useTrash).toBe(true)
    }
  })

  it('keeps valid sessions and validates the active id', () => {
    const s = coerceSettings({
      sessions: [
        { id: 'a', type: 'folders', leftRoot: 'C:/x' },
        { id: 'b', type: 'text', leftText: 'hello' }
      ],
      activeSessionId: 'b'
    })
    expect(s.sessions.map((x) => x.type)).toEqual(['folders', 'text'])
    expect(s.sessions[0].leftRoot).toBe('C:/x')
    expect(s.sessions[1].leftText).toBe('hello')
    expect(s.activeSessionId).toBe('b')
  })

  it('drops sessions with an invalid type and de-duplicates / fills ids', () => {
    const s = coerceSettings({
      sessions: [
        { id: 'dup', type: 'files' },
        { id: 'dup', type: 'text' },
        { type: 'folders' }, // missing id
        { type: 'bogus' } // invalid -> dropped
      ]
    })
    expect(s.sessions).toHaveLength(3)
    const ids = s.sessions.map((x) => x.id)
    expect(new Set(ids).size).toBe(3) // all unique
  })

  it('keeps a folders3 session and its baseRoot', () => {
    const s = coerceSettings({
      sessions: [{ id: 'tw', type: 'folders3', baseRoot: '/base', leftRoot: '/l', rightRoot: '/r' }]
    })
    expect(s.sessions[0].type).toBe('folders3')
    expect(s.sessions[0].baseRoot).toBe('/base')
  })

  it('falls back active id to the first session when invalid', () => {
    const s = coerceSettings({ sessions: [{ id: 'only', type: 'files' }], activeSessionId: 'missing' })
    expect(s.activeSessionId).toBe('only')
  })

  it('falls back to defaults when sessions is empty or not an array', () => {
    expect(coerceSettings({ sessions: [] }).sessions).toHaveLength(1)
    expect(coerceSettings({ sessions: 'x' }).sessions).toHaveLength(1)
  })

  it('coerces session options and rejects invalid enums', () => {
    const s = coerceSettings({
      sessions: [{ id: 'a', type: 'folders', options: { method: 'telepathy', filters: { ignoreCase: true } } }]
    })
    expect(s.sessions[0].options.method).toBe('content')
    expect(s.sessions[0].options.filters.ignoreCase).toBe(true)
  })

  it('keeps valid comparison profiles and drops nameless/invalid ones', () => {
    const s = coerceSettings({
      profiles: [
        { name: 'Code', options: { method: 'quick', filters: { ignoreWhitespace: true } } },
        { options: { method: 'content' } }, // no name -> dropped
        'nope' // not an object -> dropped
      ]
    })
    expect(s.profiles).toHaveLength(1)
    expect(s.profiles[0].name).toBe('Code')
    expect(s.profiles[0].options.method).toBe('quick')
    expect(s.profiles[0].options.filters.ignoreWhitespace).toBe(true)
  })

  it('defaults profiles to an empty array', () => {
    expect(coerceSettings({}).profiles).toEqual([])
  })

  it('keeps valid project scopes and drops ones missing a path', () => {
    const s = coerceSettings({
      projectScopes: [
        { left: '/a', right: '/b', options: { method: 'quick', filters: { normalizeCode: true } } },
        { left: '/a' }, // no right -> dropped
        'nope'
      ]
    })
    expect(s.projectScopes).toHaveLength(1)
    expect(s.projectScopes[0]).toMatchObject({ left: '/a', right: '/b' })
    expect(s.projectScopes[0].options.method).toBe('quick')
    expect(s.projectScopes[0].options.filters.normalizeCode).toBe(true)
  })

  it('defaults project scopes to an empty array', () => {
    expect(coerceSettings({}).projectScopes).toEqual([])
  })

  it('validates window bounds', () => {
    expect(coerceSettings({ windowBounds: { x: 1, y: 2, width: 800, height: 600 } }).windowBounds).toEqual({
      x: 1,
      y: 2,
      width: 800,
      height: 600
    })
    expect(coerceSettings({ windowBounds: { x: 1, y: 2, width: 0, height: 600 } }).windowBounds).toBeNull()
  })
})
