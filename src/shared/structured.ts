// Key-aligned structured diff for JSON / YAML / XML. Parses both documents into
// plain JS values and aligns them by object key (and array index), producing a
// tree where every node is identical / changed / added / removed. Pure; the
// parsers (yaml, fast-xml-parser) are browser-safe and bundle into the renderer.
import { parse as parseYaml } from 'yaml'
import { XMLParser } from 'fast-xml-parser'
import { astToPlain, isCodePath } from './jsast'

// 'js' covers all JS/TS-family code (js/mjs/cjs/jsx/ts/mts/cts/tsx).
export type StructKind = 'json' | 'yaml' | 'xml' | 'js'

export function structKind(path: string): StructKind | null {
  if (/\.json$/i.test(path)) return 'json'
  if (/\.ya?ml$/i.test(path)) return 'yaml'
  if (/\.xml$/i.test(path)) return 'xml'
  if (isCodePath(path)) return 'js'
  return null
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true
})

/**
 * Parse text into a plain JS value for the given kind, or return an error.
 * `path` is used for code (to pick the JS vs TS parser).
 */
export function parseStructured(
  text: string,
  kind: StructKind,
  path = 'x.js'
): { value: unknown } | { error: string } {
  try {
    if (kind === 'json') return { value: JSON.parse(text) }
    if (kind === 'yaml') return { value: parseYaml(text) }
    if (kind === 'js') return { value: astToPlain(text, path) }
    return { value: xmlParser.parse(text) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export type StructStatus = 'identical' | 'changed' | 'added' | 'removed'
export type StructValueKind = 'scalar' | 'object' | 'array'

export interface StructNode {
  /** Object key, or array index as a string. '' for the root. */
  key: string
  status: StructStatus
  kind: StructValueKind
  left?: unknown
  right?: unknown
  children?: StructNode[]
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function valueKind(v: unknown): StructValueKind {
  if (Array.isArray(v)) return 'array'
  if (isPlainObject(v)) return 'object'
  return 'scalar'
}

/** Build a node for a subtree present on only one side (all added or removed). */
function sideNode(key: string, value: unknown, status: 'added' | 'removed'): StructNode {
  const kind = valueKind(value)
  const node: StructNode = { key, status, kind }
  if (status === 'added') node.right = value
  else node.left = value
  if (kind === 'object') {
    node.children = Object.keys(value as Record<string, unknown>).map((k) =>
      sideNode(k, (value as Record<string, unknown>)[k], status)
    )
  } else if (kind === 'array') {
    node.children = (value as unknown[]).map((v, i) => sideNode(String(i), v, status))
  }
  return node
}

function aggregate(children: StructNode[]): StructStatus {
  return children.every((c) => c.status === 'identical') ? 'identical' : 'changed'
}

/** Diff two present values into a node (recursively). */
function build(key: string, left: unknown, right: unknown): StructNode {
  const lk = valueKind(left)
  const rk = valueKind(right)

  if (lk === 'object' && rk === 'object') {
    const l = left as Record<string, unknown>
    const r = right as Record<string, unknown>
    const keys: string[] = [...Object.keys(l)]
    for (const k of Object.keys(r)) if (!(k in l)) keys.push(k)
    const children = keys.map((k) => {
      if (!(k in r)) return sideNode(k, l[k], 'removed')
      if (!(k in l)) return sideNode(k, r[k], 'added')
      return build(k, l[k], r[k])
    })
    return { key, kind: 'object', status: aggregate(children), left, right, children }
  }

  if (lk === 'array' && rk === 'array') {
    const l = left as unknown[]
    const r = right as unknown[]
    const n = Math.max(l.length, r.length)
    const children: StructNode[] = []
    for (let i = 0; i < n; i++) {
      if (i >= r.length) children.push(sideNode(String(i), l[i], 'removed'))
      else if (i >= l.length) children.push(sideNode(String(i), r[i], 'added'))
      else children.push(build(String(i), l[i], r[i]))
    }
    return { key, kind: 'array', status: aggregate(children), left, right, children }
  }

  // Scalars, or a type mismatch (e.g. object vs scalar): compare by value.
  const equal = lk === 'scalar' && rk === 'scalar' && left === right
  return { key, kind: lk === rk ? lk : 'scalar', status: equal ? 'identical' : 'changed', left, right }
}

/** Diff two parsed values into an aligned structured tree (root key is ''). */
export function diffStructured(left: unknown, right: unknown): StructNode {
  return build('', left, right)
}
