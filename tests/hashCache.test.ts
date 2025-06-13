import { describe, expect, it } from 'vitest'
import { HashCache } from '../src/core/hashCache'

describe('HashCache', () => {
  it('returns a hit only when path/size/mtime/flags all match', () => {
    const c = new HashCache()
    c.set('/a.txt', 100, 5000, false, false, 'HASH')
    expect(c.get('/a.txt', 100, 5000, false, false)).toBe('HASH')
    expect(c.get('/a.txt', 101, 5000, false, false)).toBeUndefined() // size changed
    expect(c.get('/a.txt', 100, 5001, false, false)).toBeUndefined() // mtime changed
    expect(c.get('/a.txt', 100, 5000, true, false)).toBeUndefined() // ws flag differs
    expect(c.get('/a.txt', 100, 5000, false, true)).toBeUndefined() // ic flag differs
    expect(c.get('/other', 100, 5000, false, false)).toBeUndefined()
  })

  it('round-trips through JSON and skips malformed entries', () => {
    const c = new HashCache()
    c.set('/x', 1, 2, false, true, 'h1')
    const restored = HashCache.fromJSON(JSON.parse(JSON.stringify(c.toJSON())))
    expect(restored.get('/x', 1, 2, false, true)).toBe('h1')

    const dirty = HashCache.fromJSON({
      '/good': { size: 1, mtimeMs: 2, ws: false, ic: false, hash: 'ok' },
      '/bad': { size: 'nope', hash: 5 }
    })
    expect(dirty.get('/good', 1, 2, false, false)).toBe('ok')
    expect(dirty.size).toBe(1)
  })

  it('fromJSON tolerates garbage input', () => {
    expect(HashCache.fromJSON(undefined).size).toBe(0)
    expect(HashCache.fromJSON(42).size).toBe(0)
  })
})
