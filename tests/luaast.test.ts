import { describe, expect, it } from 'vitest'
import { isLuaPath, canonicalizeLua, luaAstToPlain } from '../src/shared/luaast'
import { structKind, parseStructured, diffStructured } from '../src/shared/structured'

describe('isLuaPath', () => {
  it('matches .lua case-insensitively', () => {
    expect(isLuaPath('mod.lua')).toBe(true)
    expect(isLuaPath('C:/scripts/Init.LUA')).toBe(true)
    expect(isLuaPath('a.js')).toBe(false)
    expect(isLuaPath('a.lua.txt')).toBe(false)
  })
})

describe('canonicalizeLua', () => {
  it('ignores comments, whitespace and semicolons', () => {
    const a = canonicalizeLua('-- header\nlocal x = 1\nfunction f(a) return a+1 end')
    const b = canonicalizeLua('local x = 1;\n\n--[[ other ]]\nfunction f(a)\n  return a + 1\nend')
    expect(a).not.toBeNull()
    expect(a).toBe(b)
  })

  it('treats equivalent numeric literals the same (raw dropped)', () => {
    expect(canonicalizeLua('local n = 0x10')).toBe(canonicalizeLua('local n = 16'))
  })

  it('distinguishes real logic differences', () => {
    expect(canonicalizeLua('local x = 1')).not.toBe(canonicalizeLua('local x = 2'))
    expect(canonicalizeLua('f(a, b)')).not.toBe(canonicalizeLua('f(b, a)'))
  })

  it('returns null for unparseable source', () => {
    expect(canonicalizeLua('function (')).toBeNull()
    expect(canonicalizeLua('local = = ')).toBeNull()
  })
})

describe('lua via the structured pipeline', () => {
  it('routes .lua to the lua kind', () => {
    expect(structKind('a.lua')).toBe('lua')
  })

  it('parses to a plain AST and diffs formatting-insensitively', () => {
    const l = parseStructured('local x = 1  -- a', 'lua')
    const r = parseStructured('local x = 1', 'lua')
    expect('value' in l && 'value' in r).toBe(true)
    if ('value' in l && 'value' in r) {
      const tree = diffStructured(l.value, r.value)
      expect(tree.status).toBe('identical')
    }
  })

  it('surfaces a semantic difference in the diff tree', () => {
    const l = parseStructured('local x = 1', 'lua')
    const r = parseStructured('local x = 2', 'lua')
    if ('value' in l && 'value' in r) {
      expect(diffStructured(l.value, r.value).status).toBe('changed')
    }
  })

  it('luaAstToPlain returns a Chunk root', () => {
    const plain = luaAstToPlain('return 1') as { type?: string }
    expect(plain.type).toBe('Chunk')
  })
})
