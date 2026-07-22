// Parse Lua source to an AST via luaparse and canonicalize it (drop verbatim
// literal formatting) for semantic comparison. Shared by the hash normalizer
// (core) and the structured/AST view (renderer). Browser-safe — luaparse is
// pure JS with no Node imports.
import { parse } from 'luaparse'

// luaparse already omits positions when locations/ranges are off; we additionally
// drop `raw` so two files differing only in how a literal is spelled (0x10 vs 16,
// "a" vs 'a') compare equal — matching the JS/TS canonicalizer's behavior.
const DROP = new Set(['raw'])

const PARSE_OPTS = {
  comments: false,
  locations: false,
  ranges: false,
  luaVersion: '5.3' as const
}

/** Lua source files the code comparator understands. */
export function isLuaPath(p: string): boolean {
  return /\.lua$/i.test(p)
}

/** Parse Lua to an AST (throws on syntax error). */
export function parseLuaAst(text: string): unknown {
  return parse(text, PARSE_OPTS)
}

/** A plain AST object with verbatim literal formatting stripped (for diffing). */
export function luaAstToPlain(text: string): unknown {
  return JSON.parse(JSON.stringify(parseLuaAst(text), (k, v) => (DROP.has(k) ? undefined : v)))
}

/** Canonical AST JSON string, or null if the source can't be parsed. */
export function canonicalizeLua(text: string): string | null {
  try {
    return JSON.stringify(parseLuaAst(text), (k, v) => (DROP.has(k) ? undefined : v))
  } catch {
    return null
  }
}
