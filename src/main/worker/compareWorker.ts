import { parentPort } from 'node:worker_threads'
import { readFile, writeFile } from 'node:fs/promises'
import { compareFolders, type CompareEngineInput } from '../../core/compare'
import {
  captureSnapshot,
  snapshotCompareOptions,
  snapshotToWalkEntries
} from '../../core/snapshot'
import { isSnapshotPath, parseSnapshot, type Snapshot } from '../../shared/snapshot'
import { HashCache } from '../../core/hashCache'
import type { CompareOptions } from '../../shared/types'
import type { WalkEntry } from '../../core/walk'

// Message protocol between the main process and this worker.
export type WorkerRequest =
  | {
      id: number
      kind?: 'compare'
      leftRoot: string
      rightRoot: string
      options: CompareOptions
      /** Path to load/save the persistent hash cache (optional). */
      cachePath?: string
    }
  | { id: number; kind: 'capture'; root: string; options: CompareOptions }

export type WorkerMessage =
  | { type: 'progress'; id: number; update: Parameters<NonNullable<CompareEngineInput['onProgress']>>[0] }
  | { type: 'result'; id: number; result: Awaited<ReturnType<typeof compareFolders>> }
  | { type: 'snapshot'; id: number; snapshot: Snapshot }
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

/** Load a snapshot from disk, throwing a readable error if it's malformed. */
async function loadSnapshot(path: string): Promise<Snapshot> {
  const snap = parseSnapshot(await readFile(path, 'utf8'))
  if (!snap) throw new Error(`Not a valid Juxta snapshot: ${path}`)
  return snap
}

async function runCompare(req: Extract<WorkerRequest, { kind?: 'compare' }>): Promise<void> {
  const activeCache = await ensureCache(req.cachePath)

  // Either side may be a saved snapshot file instead of a live folder.
  let leftEntries: WalkEntry[] | undefined
  let rightEntries: WalkEntry[] | undefined
  let leftLabel = req.leftRoot
  let rightLabel = req.rightRoot
  let snap: Snapshot | undefined

  if (isSnapshotPath(req.leftRoot)) {
    const s = await loadSnapshot(req.leftRoot)
    snap = s
    leftEntries = snapshotToWalkEntries(s)
    leftLabel = `${s.root} @snapshot`
  }
  if (isSnapshotPath(req.rightRoot)) {
    const s = await loadSnapshot(req.rightRoot)
    snap = snap ?? s
    rightEntries = snapshotToWalkEntries(s)
    rightLabel = `${s.root} @snapshot`
  }

  // When comparing against a snapshot, hash the live side raw (matching how the
  // snapshot was captured) and reuse the snapshot's include/exclude globs.
  const options = snap ? snapshotCompareOptions(snap) : req.options

  const result = await compareFolders({
    leftRoot: leftLabel,
    rightRoot: rightLabel,
    options,
    leftEntries,
    rightEntries,
    cache: activeCache,
    onProgress: (update) => {
      port.postMessage({ type: 'progress', id: req.id, update } satisfies WorkerMessage)
    }
  })
  await saveCache(req.cachePath)
  port.postMessage({ type: 'result', id: req.id, result } satisfies WorkerMessage)
}

port.on('message', async (req: WorkerRequest) => {
  try {
    if (req.kind === 'capture') {
      const snapshot = await captureSnapshot(req.root, req.options)
      port.postMessage({ type: 'snapshot', id: req.id, snapshot } satisfies WorkerMessage)
      return
    }
    await runCompare(req)
  } catch (err) {
    port.postMessage({
      type: 'error',
      id: req.id,
      message: err instanceof Error ? err.message : String(err)
    } satisfies WorkerMessage)
  }
})
