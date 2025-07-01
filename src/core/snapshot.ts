import { join } from 'node:path'
import type { CompareOptions } from '../shared/types'
import {
  SNAPSHOT_VERSION,
  type Snapshot,
  type SnapshotEntry
} from '../shared/snapshot'
import { createWalkMatcher } from './filters'
import { createIgnoreMatcher } from './ignore'
import { readFile } from 'node:fs/promises'
import { hashFileRaw } from './hash'
import { walkTree, type WalkEntry } from './walk'

/**
 * Walk a folder and record every included entry's size, mtime and raw content
 * hash. The result is a serializable snapshot that a later comparison can diff
 * a live folder against — without needing the original folder present.
 */
export async function captureSnapshot(
  root: string,
  options: CompareOptions,
  now: () => number = () => Date.now()
): Promise<Snapshot> {
  let ignore
  if (options.filters.useGitignore) {
    try {
      ignore = createIgnoreMatcher(await readFile(join(root, '.gitignore'), 'utf8'))
    } catch {
      ignore = undefined
    }
  }
  const matcher = createWalkMatcher(options.filters, ignore)
  const walked = await walkTree(root, { matcher })

  const entries: SnapshotEntry[] = []
  for (const e of walked) {
    const entry: SnapshotEntry = {
      relPath: e.relPath,
      name: e.name,
      kind: e.kind,
      size: e.size,
      mtimeMs: e.mtimeMs
    }
    if (e.kind === 'file') {
      try {
        entry.hash = await hashFileRaw(e.path)
      } catch {
        // Unreadable file: leave hash undefined; it'll compare by size only.
      }
    }
    entries.push(entry)
  }

  return { version: SNAPSHOT_VERSION, root, capturedAt: now(), options, entries }
}

/**
 * Turn snapshot entries into WalkEntry objects with hashes pre-populated, so
 * they can be fed to the compare engine as a "side" without touching the disk.
 */
export function snapshotToWalkEntries(snap: Snapshot): WalkEntry[] {
  return snap.entries.map((e) => ({
    relPath: e.relPath,
    name: e.name,
    kind: e.kind,
    // A path for display / potential merge; the file may no longer exist.
    path: join(snap.root, e.relPath.replace(/\//g, '\\')),
    size: e.size,
    mtimeMs: e.mtimeMs,
    hash: e.hash
  }))
}

/**
 * Options for comparing against a snapshot: raw content comparison using the
 * snapshot's include/exclude globs. Content-transforming filters are cleared so
 * the live side is hashed the same way the snapshot was (raw SHA-1).
 */
export function snapshotCompareOptions(snap: Snapshot): CompareOptions {
  return {
    method: 'content',
    filters: {
      ...snap.options.filters,
      ignoreWhitespace: false,
      ignoreCase: false,
      ignoreLinePattern: '',
      ignoreBlankLines: false,
      normalizeJson: false,
      normalizeCsv: false,
      normalizeYaml: false
    }
  }
}
