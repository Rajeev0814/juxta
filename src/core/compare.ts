import type {
  CompareNode,
  CompareOptions,
  CompareResult,
  CompareSummary,
  DiffStatus,
  EntryKind,
  MovePair,
  Newer,
  SideInfo
} from '../shared/types'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createWalkMatcher } from './filters'
import { hashFile } from './hash'
import { createIgnoreMatcher, type IgnoreMatcher } from './ignore'
import type { HashCache } from './hashCache'
import { walkTree, type WalkEntry } from './walk'

export interface ProgressSink {
  (update: {
    phase: 'walking' | 'hashing' | 'comparing' | 'done'
    processed: number
    total: number
    currentPath?: string
  }): void
}

/** mtime tolerance in ms — FAT/exFAT volumes have ~2s timestamp resolution. */
const MTIME_TOLERANCE_MS = 2000

/** Hash a file, consulting/updating the persistent cache when provided. */
async function cachedHash(
  entry: WalkEntry,
  options: CompareOptions,
  cache: HashCache | undefined
): Promise<string | undefined> {
  const ws = options.filters.ignoreWhitespace
  const ic = options.filters.ignoreCase
  const hit = cache?.get(entry.path, entry.size, entry.mtimeMs, ws, ic)
  if (hit !== undefined) return hit
  try {
    const hash = await hashFile(entry.path, { ignoreWhitespace: ws, ignoreCase: ic })
    cache?.set(entry.path, entry.size, entry.mtimeMs, ws, ic, hash)
    return hash
  } catch {
    return undefined
  }
}

/** Read a root's .gitignore (if any) and compile it into a matcher. */
async function loadGitignore(root: string): Promise<IgnoreMatcher | undefined> {
  try {
    const content = await readFile(join(root, '.gitignore'), 'utf8')
    return createIgnoreMatcher(content)
  } catch {
    return undefined // no .gitignore at this root
  }
}

interface MergedEntry {
  key: string
  relPath: string
  name: string
  kind: EntryKind
  left?: WalkEntry
  right?: WalkEntry
}

function keyOf(relPath: string, ignoreCase: boolean): string {
  return ignoreCase ? relPath.toLowerCase() : relPath
}

function parentKeyOf(relPath: string, ignoreCase: boolean): string {
  const idx = relPath.lastIndexOf('/')
  if (idx < 0) return '' // root
  return keyOf(relPath.slice(0, idx), ignoreCase)
}

function toSideInfo(entry: WalkEntry): SideInfo {
  return { path: entry.path, size: entry.size, mtimeMs: entry.mtimeMs, hash: entry.hash }
}

/** Run an async mapper over items with a bounded concurrency. */
async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      await fn(items[i])
    }
  })
  await Promise.all(workers)
}

/** Decide identical/different (and which side is newer) for a file present on both sides. */
function compareFilePair(
  left: WalkEntry,
  right: WalkEntry,
  options: CompareOptions
): { status: DiffStatus; newer: Newer } {
  const newer: Newer =
    Math.abs(left.mtimeMs - right.mtimeMs) < MTIME_TOLERANCE_MS
      ? 'same'
      : left.mtimeMs > right.mtimeMs
        ? 'left'
        : 'right'

  let identical: boolean
  switch (options.method) {
    case 'quick':
      identical = left.size === right.size
      break
    case 'sizeAndTime':
      identical =
        left.size === right.size && Math.abs(left.mtimeMs - right.mtimeMs) < MTIME_TOLERANCE_MS
      break
    case 'content':
      // Hashes are populated in the hashing phase. If absent (e.g. size
      // mismatch short-circuit) fall back to size comparison.
      identical =
        left.hash !== undefined && right.hash !== undefined
          ? left.hash === right.hash
          : left.size === right.size
      break
  }

  return { status: identical ? 'identical' : 'different', newer }
}

export interface CompareEngineInput {
  leftRoot: string
  rightRoot: string
  options: CompareOptions
  onProgress?: ProgressSink
  /** Optional persistent hash cache to skip re-hashing unchanged files. */
  cache?: HashCache
  /** Injectable clock for deterministic tests. */
  now?: () => number
}

/**
 * Compare two folder trees and return a merged tree plus summary counts.
 * The heavy lifting (walking + hashing) is async and reports progress so a
 * worker thread can keep the UI responsive on large trees.
 */
export async function compareFolders(input: CompareEngineInput): Promise<CompareResult> {
  const { leftRoot, rightRoot, options, onProgress } = input
  const clock = input.now ?? (() => Date.now())
  const startedAt = clock()
  const ignoreCase = options.filters.ignoreCase

  // Each root applies its own .gitignore (when enabled), so the two sides can
  // legitimately ignore different things.
  const [leftIgnore, rightIgnore] = options.filters.useGitignore
    ? await Promise.all([loadGitignore(leftRoot), loadGitignore(rightRoot)])
    : [undefined, undefined]
  const leftMatcher = createWalkMatcher(options.filters, leftIgnore)
  const rightMatcher = createWalkMatcher(options.filters, rightIgnore)

  // --- Phase 1: walk both trees -------------------------------------------
  onProgress?.({ phase: 'walking', processed: 0, total: 0 })
  let walked = 0
  const [leftEntries, rightEntries] = await Promise.all([
    walkTree(leftRoot, {
      matcher: leftMatcher,
      onEntry: (_c, p) => onProgress?.({ phase: 'walking', processed: ++walked, total: 0, currentPath: p })
    }),
    walkTree(rightRoot, {
      matcher: rightMatcher,
      onEntry: (_c, p) => onProgress?.({ phase: 'walking', processed: ++walked, total: 0, currentPath: p })
    })
  ])

  // --- Phase 2: merge the two listings by relative path --------------------
  const merged = new Map<string, MergedEntry>()
  const childrenOf = new Map<string, string[]>()

  function ensure(entry: WalkEntry, side: 'left' | 'right'): void {
    const key = keyOf(entry.relPath, ignoreCase)
    let m = merged.get(key)
    if (!m) {
      m = { key, relPath: entry.relPath, name: entry.name, kind: entry.kind }
      merged.set(key, m)
      const pk = parentKeyOf(entry.relPath, ignoreCase)
      const siblings = childrenOf.get(pk)
      if (siblings) siblings.push(key)
      else childrenOf.set(pk, [key])
    }
    m[side] = entry
    // If one side is a directory, treat the merged node as a directory.
    if (entry.kind === 'directory') m.kind = 'directory'
  }

  for (const e of leftEntries) ensure(e, 'left')
  for (const e of rightEntries) ensure(e, 'right')

  // --- Phase 3: hash file pairs that need content comparison ---------------
  if (options.method === 'content') {
    const toHash: WalkEntry[] = []
    for (const m of merged.values()) {
      if (m.kind !== 'file') continue
      if (!m.left || !m.right) continue // only-one-side files don't need hashing
      const sizeMatch = m.left.size === m.right.size
      const mustHash = options.filters.ignoreWhitespace || options.filters.ignoreCase || sizeMatch
      if (mustHash) {
        toHash.push(m.left, m.right)
      }
    }
    const total = toHash.length
    let processed = 0
    await mapPool(toHash, 8, async (entry) => {
      entry.hash = await cachedHash(entry, options, input.cache)
      onProgress?.({ phase: 'hashing', processed: ++processed, total, currentPath: entry.path })
    })
  }

  // --- Phase 4: build the merged tree and compute statuses -----------------
  onProgress?.({ phase: 'comparing', processed: 0, total: merged.size })
  const summary: CompareSummary = {
    identical: 0,
    different: 0,
    leftOnly: 0,
    rightOnly: 0,
    moved: 0,
    totalFiles: 0
  }
  const fileNodeIndex = new Map<string, CompareNode>()

  function buildNode(key: string): CompareNode {
    const m = merged.get(key)!
    const base: CompareNode = {
      name: m.name,
      relPath: m.relPath,
      kind: m.kind,
      status: 'identical',
      left: m.left ? toSideInfo(m.left) : undefined,
      right: m.right ? toSideInfo(m.right) : undefined
    }

    if (m.kind === 'file') fileNodeIndex.set(m.relPath, base)

    if (m.kind === 'directory') {
      const childKeys = childrenOf.get(key) ?? []
      const children = childKeys.map(buildNode)
      // Directories first, then files; alphabetical within each group.
      children.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      base.children = children
      base.status = aggregateStatus(m, children)
      return base
    }

    // File node.
    summary.totalFiles++
    if (m.left && m.right) {
      const { status, newer } = compareFilePair(m.left, m.right, options)
      base.status = status
      base.newer = newer
    } else if (m.left) {
      base.status = 'leftOnly'
    } else {
      base.status = 'rightOnly'
    }
    summary[base.status]++
    return base
  }

  function aggregateStatus(m: MergedEntry, children: CompareNode[]): DiffStatus {
    if (m.left && !m.right) return 'leftOnly'
    if (!m.left && m.right) return 'rightOnly'
    // Present on both sides: identical only if every child is identical.
    if (children.length === 0) return 'identical'
    return children.every((c) => c.status === 'identical') ? 'identical' : 'different'
  }

  const rootChildKeys = childrenOf.get('') ?? []
  const rootChildren = rootChildKeys.map(buildNode)
  rootChildren.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  const root: CompareNode = {
    name: '',
    relPath: '',
    kind: 'directory',
    status: rootChildren.every((c) => c.status === 'identical') ? 'identical' : 'different',
    children: rootChildren
  }

  // --- Phase 5: detect renamed/moved files (content comparisons only) ------
  const moves =
    options.method === 'content'
      ? await detectMoves(merged, fileNodeIndex, summary, options, input.cache)
      : []

  onProgress?.({ phase: 'done', processed: merged.size, total: merged.size })

  return {
    leftRoot,
    rightRoot,
    options,
    root,
    summary,
    moves,
    elapsedMs: clock() - startedAt
  }
}

/**
 * Pair left-only and right-only files that have identical content (same hash)
 * as renames/moves. Annotates the corresponding nodes and updates the summary.
 */
async function detectMoves(
  merged: Map<string, MergedEntry>,
  fileNodeIndex: Map<string, CompareNode>,
  summary: CompareSummary,
  options: CompareOptions,
  cache: HashCache | undefined
): Promise<MovePair[]> {
  const leftOrphans: WalkEntry[] = []
  const rightOrphans: WalkEntry[] = []
  for (const m of merged.values()) {
    if (m.kind !== 'file') continue
    if (m.left && !m.right) leftOrphans.push(m.left)
    else if (m.right && !m.left) rightOrphans.push(m.right)
  }
  if (leftOrphans.length === 0 || rightOrphans.length === 0) return []

  await mapPool([...leftOrphans, ...rightOrphans], 8, async (entry) => {
    if (entry.hash === undefined) entry.hash = await cachedHash(entry, options, cache)
  })

  // Map right-orphan hash -> queue of relPaths (handle duplicate-content files).
  const rightByHash = new Map<string, string[]>()
  for (const r of rightOrphans) {
    if (r.hash === undefined) continue
    const list = rightByHash.get(r.hash)
    if (list) list.push(r.relPath)
    else rightByHash.set(r.hash, [r.relPath])
  }

  const moves: MovePair[] = []
  for (const l of leftOrphans) {
    if (l.hash === undefined) continue
    const candidates = rightByHash.get(l.hash)
    if (!candidates || candidates.length === 0) continue
    const toRel = candidates.shift()!
    moves.push({ from: l.relPath, to: toRel })
    summary.moved++
    const fromNode = fileNodeIndex.get(l.relPath)
    const toNode = fileNodeIndex.get(toRel)
    if (fromNode) fromNode.movedTo = toRel
    if (toNode) toNode.movedFrom = l.relPath
  }
  return moves
}
