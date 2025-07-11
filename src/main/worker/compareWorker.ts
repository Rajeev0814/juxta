import { parentPort } from 'node:worker_threads'
import { readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { compareFolders, type CompareEngineInput } from '../../core/compare'
import { compareFolders3 } from '../../core/compare3'
import type { ThreeWayResult } from '../../shared/types'
import {
  captureSnapshot,
  rawContentOptions,
  snapshotCompareOptions,
  snapshotToWalkEntries
} from '../../core/snapshot'
import { archiveToWalkEntries, isArchivePath, readArchiveEntries } from '../../core/archive'
import { basename } from 'node:path'
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
  | { id: number; kind: 'compare3'; baseRoot: string; leftRoot: string; rightRoot: string; options: CompareOptions }

export type WorkerMessage =
  | { type: 'progress'; id: number; update: Parameters<NonNullable<CompareEngineInput['onProgress']>>[0] }
  | { type: 'result'; id: number; result: Awaited<ReturnType<typeof compareFolders>> }
  | { type: 'result3'; id: number; result: ThreeWayResult }
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
function parseSnapshotSync(path: string): Snapshot {
  const snap = parseSnapshot(readFileSync(path, 'utf8'))
  if (!snap) throw new Error(`Not a valid Juxta snapshot: ${path}`)
  return snap
}

async function runCompare(req: Extract<WorkerRequest, { kind?: 'compare' }>): Promise<void> {
  const activeCache = await ensureCache(req.cachePath)

  // Either side may be a saved snapshot file or an archive instead of a live
  // folder — both supply pre-hashed entries so that side never touches disk.
  let leftEntries: WalkEntry[] | undefined
  let rightEntries: WalkEntry[] | undefined
  let leftLabel = req.leftRoot
  let rightLabel = req.rightRoot
  let snap: Snapshot | undefined
  let preHashed = false

  const resolveSide = (path: string): { entries?: WalkEntry[]; label: string } => {
    if (isSnapshotPath(path)) {
      const s = parseSnapshotSync(path)
      snap = snap ?? s
      preHashed = true
      return { entries: snapshotToWalkEntries(s), label: `${s.root} @snapshot` }
    }
    if (isArchivePath(path)) {
      preHashed = true
      return { entries: archiveToWalkEntries(readArchiveEntries(path), path), label: `${basename(path)} (archive)` }
    }
    return { label: path }
  }

  const left = resolveSide(req.leftRoot)
  const right = resolveSide(req.rightRoot)
  leftEntries = left.entries
  rightEntries = right.entries
  leftLabel = left.label
  rightLabel = right.label

  // A pre-hashed side (snapshot / archive) forces raw-content comparison so the
  // live side is hashed the same way (raw SHA-1). A snapshot brings its own globs.
  const options = snap ? snapshotCompareOptions(snap) : preHashed ? rawContentOptions(req.options) : req.options

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
    if (req.kind === 'compare3') {
      const result = await compareFolders3({
        baseRoot: req.baseRoot,
        leftRoot: req.leftRoot,
        rightRoot: req.rightRoot,
        options: req.options
      })
      port.postMessage({ type: 'result3', id: req.id, result } satisfies WorkerMessage)
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
