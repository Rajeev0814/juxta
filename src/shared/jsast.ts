// Parse JavaScript / TypeScript (incl. JSX/TSX) to an ESTree AST via acorn plus
// pure-JS plugins, and canonicalize it (drop positional/formatting fields) for
// semantic comparison. Shared by the hash normalizer (core) and the AST view
// (renderer). Browser-safe — no Node imports.
import { Parser } from 'acorn'
import tsPlugin from 'acorn-typescript'
import jsxPlugin from 'acorn-jsx'

// Two extended parsers: JS(+JSX) and TS(+TSX). Built once.
const JsParser = Parser.extend(jsxPlugin())
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TsParser = Parser.extend((tsPlugin as any)({ jsx: true }))

const BASE = {
  ecmaVersion: 'latest' as const,
  allowReturnOutsideFunction: true,
  allowAwaitOutsideFunction: true,
  allowSuperOutsideMethod: true,
  allowHashBang: true
}

// AST fields that carry position or verbatim formatting, not structure.
const DROP = new Set(['start', 'end', 'loc', 'range', 'raw'])

/** Source files the code comparator understands. */
export function isCodePath(p: string): boolean {
  return /\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)$/i.test(p)
}

/** Human label for the code kind (for the UI / Monaco language). */
export function codeLanguage(path: string): 'typescript' | 'javascript' {
  return /\.(ts|mts|cts|tsx)$/i.test(path) ? 'typescript' : 'javascript'
}

function parserFor(path: string): typeof Parser {
  return /\.(ts|mts|cts|tsx)$/i.test(path) ? TsParser : JsParser
}

/** Parse code to an AST (throws on syntax error). `path` picks the JS/TS parser. */
export function parseCodeAst(text: string, path = 'x.js'): unknown {
  const P = parserFor(path)
  let lastErr: unknown
  for (const sourceType of ['module', 'script'] as const) {
    try {
      return P.parse(text, { ...BASE, sourceType })
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

/** A plain AST object with positional/formatting fields stripped (for diffing). */
export function astToPlain(text: string, path = 'x.js'): unknown {
  return JSON.parse(JSON.stringify(parseCodeAst(text, path), (k, v) => (DROP.has(k) ? undefined : v)))
}

/** Canonical AST JSON string, or null if the source can't be parsed. */
export function canonicalizeCode(text: string, path = 'x.js'): string | null {
  try {
    return JSON.stringify(parseCodeAst(text, path), (k, v) => (DROP.has(k) ? undefined : v))
  } catch {
    return null
  }
}
