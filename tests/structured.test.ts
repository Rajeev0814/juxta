import { describe, expect, it } from 'vitest'
import { diffStructured, parseStructured, structKind } from '../src/shared/structured'
import type { StructNode } from '../src/shared/structured'

function child(node: StructNode, key: string): StructNode | undefined {
  return node.children?.find((c) => c.key === key)
}

describe('structKind', () => {
  it('detects json / yaml / xml by extension', () => {
    expect(structKind('a.json')).toBe('json')
    expect(structKind('a.yaml')).toBe('yaml')
    expect(structKind('a.yml')).toBe('yaml')
    expect(structKind('a.xml')).toBe('xml')
    expect(structKind('a.txt')).toBeNull()
  })
})

describe('structKind', () => {
  it('detects js/mjs/cjs', () => {
    expect(structKind('a.js')).toBe('js')
    expect(structKind('a.mjs')).toBe('js')
    expect(structKind('a.cjs')).toBe('js')
  })
})

describe('parseStructured', () => {
  it('parses each kind and reports errors', () => {
    expect(parseStructured('{"a":1}', 'json')).toEqual({ value: { a: 1 } })
    expect(parseStructured('a: 1', 'yaml')).toEqual({ value: { a: 1 } })
    expect('error' in parseStructured('{bad', 'json')).toBe(true)
  })

  it('parses JS into a positional-field-free AST and reports parse errors', () => {
    const r = parseStructured('const x = 1', 'js')
    expect('value' in r).toBe(true)
    const json = JSON.stringify(r)
    expect(json).toContain('"type":"Program"')
    expect(json).not.toContain('"start"') // positional fields stripped
    expect('error' in parseStructured('function (', 'js')).toBe(true)
  })

  it('produces an AST diff that ignores formatting but catches logic changes', () => {
    const a = parseStructured('const x = 1 // c', 'js')
    const b = parseStructured('const  x=1;', 'js')
    const c = parseStructured('const x = 2', 'js')
    if (!('value' in a) || !('value' in b) || !('value' in c)) throw new Error('parse failed')
    expect(diffStructured(a.value, b.value).status).toBe('identical')
    expect(diffStructured(a.value, c.value).status).toBe('changed')
  })
})

describe('diffStructured', () => {
  it('aligns object keys and marks changed / added / removed', () => {
    const left = { name: 'app', version: '1.0', keep: true }
    const right = { name: 'app', version: '2.0', added: 42 }
    const tree = diffStructured(left, right)

    expect(tree.status).toBe('changed')
    expect(child(tree, 'name')!.status).toBe('identical')
    expect(child(tree, 'version')!.status).toBe('changed')
    expect(child(tree, 'version')!.left).toBe('1.0')
    expect(child(tree, 'version')!.right).toBe('2.0')
    expect(child(tree, 'keep')!.status).toBe('removed')
    expect(child(tree, 'added')!.status).toBe('added')
  })

  it('recurses into nested objects and aligns arrays by index', () => {
    const left = { deps: { a: 1, b: 2 }, list: [1, 2, 3] }
    const right = { deps: { a: 1, b: 9 }, list: [1, 2] }
    const tree = diffStructured(left, right)

    const deps = child(tree, 'deps')!
    expect(deps.status).toBe('changed')
    expect(child(deps, 'b')!.status).toBe('changed')

    const list = child(tree, 'list')!
    expect(list.kind).toBe('array')
    expect(child(list, '2')!.status).toBe('removed') // index 2 dropped
  })

  it('reports identical trees', () => {
    const tree = diffStructured({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })
    expect(tree.status).toBe('identical')
  })
})
