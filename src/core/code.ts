// Semantic (AST-level) canonicalization for JavaScript. Parses the source with
// acorn and serializes the syntax tree with positional/formatting fields removed
// — so two files differing only in comments, whitespace, semicolons or quote
// style produce the same canonical form. Returns null when the source can't be
// parsed. Pure.
import { parse, type Options } from 'acorn'

const BASE: Options = {
  ecmaVersion: 'latest',
  allowReturnOutsideFunction: true,
  allowAwaitOutsideFunction: true,
  allowSuperOutsideMethod: true,
  allowHashBang: true
}

// Node fields that carry position or verbatim formatting, not meaning.
const DROP = new Set(['start', 'end', 'loc', 'range', 'raw'])

function replacer(key: string, value: unknown): unknown {
  return DROP.has(key) ? undefined : value
}

export function canonicalizeCode(text: string): string | null {
  // Try as a module first, then fall back to a script (top-level `return`, etc).
  for (const sourceType of ['module', 'script'] as const) {
    try {
      const ast = parse(text, { ...BASE, sourceType })
      return JSON.stringify(ast, replacer)
    } catch {
      // try the next source type
    }
  }
  return null
}
