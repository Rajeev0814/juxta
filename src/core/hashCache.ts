// A persistent file-hash cache. A hash is reused only when the path, size,
// mtime AND the normalization flags (ignore-whitespace / ignore-case) all
// match, so changed files or different compare options correctly miss.
//
// Tradeoff (standard for hash caches): a file edited in place that keeps the
// same size and mtime would hit a stale entry. This is rare and matches how
// other compare tools behave.

export interface HashCacheEntry {
  size: number
  mtimeMs: number
  ws: boolean // ignoreWhitespace flag the hash was computed under
  ic: boolean // ignoreCase flag
  hash: string
}

function isEntry(v: unknown): v is HashCacheEntry {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return (
    typeof e.size === 'number' &&
    typeof e.mtimeMs === 'number' &&
    typeof e.ws === 'boolean' &&
    typeof e.ic === 'boolean' &&
    typeof e.hash === 'string'
  )
}

export class HashCache {
  private map: Map<string, HashCacheEntry>

  constructor(entries?: Record<string, HashCacheEntry>) {
    this.map = new Map(entries ? Object.entries(entries) : [])
  }

  /** Returns the cached hash if path/size/mtime/flags all match, else undefined. */
  get(path: string, size: number, mtimeMs: number, ws: boolean, ic: boolean): string | undefined {
    const e = this.map.get(path)
    if (e && e.size === size && e.mtimeMs === mtimeMs && e.ws === ws && e.ic === ic) return e.hash
    return undefined
  }

  set(path: string, size: number, mtimeMs: number, ws: boolean, ic: boolean, hash: string): void {
    this.map.set(path, { size, mtimeMs, ws, ic, hash })
  }

  get size(): number {
    return this.map.size
  }

  toJSON(): Record<string, HashCacheEntry> {
    return Object.fromEntries(this.map)
  }

  /** Build a cache from parsed JSON, skipping any malformed entries. Never throws. */
  static fromJSON(raw: unknown): HashCache {
    const cache = new HashCache()
    if (typeof raw === 'object' && raw !== null) {
      for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
        if (isEntry(value)) cache.map.set(path, value)
      }
    }
    return cache
  }
}
