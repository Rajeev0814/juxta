import { parentPort } from 'node:worker_threads'
import { readFile, writeFile } from 'node:fs/promises'
import { compareFolders, type CompareEngineInput } from '../../core/compare'
import { HashCache } from '../../core/hashCache'
import type { CompareOptions } from '../../shared/types'

// Message protocol between the main process and this worker.
export interface WorkerRequest {
  id: number
  leftRoot: string
  rightRoot: string
  options: CompareOptions
  /** Path to load/save the persistent hash cache (optional). */
  cachePath?: string
}

export type WorkerMessage =
  | { type: 'progress'; id: number; update: Parameters<NonNullable<CompareEngineInput['onProgress']>>[0] }
  | { type: 'result'; id: number; result: Awaited<ReturnType<typeof compareFolders>> }
  | { type: 'error'; id: number; message: string }

if (!parentPort) {
  throw new Error('compareWorker must be run as a worker thread')
}

const port = parentPort

// The hash cache persists across compares within this worker's lifetime and on
// disk, so unchanged files are not re-hashed on a re-compare or after restart.
let cache: HashCache | null = null
let cacheLoadedFrom: string | undefined

async function ensureCache(path?: string): Promise<HashCache | undefined> {
  if (!path) return undefined
  if (cache && cacheLoadedFrom === path) return cache
  try {
    cache = HashCache.fromJSON(JSON.parse(await readFile(path, 'utf8')))
  } catch {
    cache = new HashCache()
  }
  cacheLoadedFrom = path
  return cache
}

async function saveCache(path?: string): Promise<void> {
  if (!path || !cache) return
  try {
    await writeFile(path, JSON.stringify(cache.toJSON()), 'utf8')
  } catch {
    // Non-fatal: the cache is an optimization, not required state.
  }
}

port.on('message', async (req: WorkerRequest) => {
  try {
    const activeCache = await ensureCache(req.cachePath)
    const result = await compareFolders({
      leftRoot: req.leftRoot,
      rightRoot: req.rightRoot,
      options: req.options,
      cache: activeCache,
      onProgress: (update) => {
        port.postMessage({ type: 'progress', id: req.id, update } satisfies WorkerMessage)
      }
    })
    await saveCache(req.cachePath)
    port.postMessage({ type: 'result', id: req.id, result } satisfies WorkerMessage)
  } catch (err) {
    port.postMessage({
      type: 'error',
      id: req.id,
      message: err instanceof Error ? err.message : String(err)
    } satisfies WorkerMessage)
  }
})
