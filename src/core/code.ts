// Semantic (AST-level) canonicalization for JS/TS. The implementation lives in
// shared/jsast.ts (browser-safe, reused by the renderer's AST view); re-exported
// here for the core hash pipeline and existing importers.
export { canonicalizeCode } from '../shared/jsast'
