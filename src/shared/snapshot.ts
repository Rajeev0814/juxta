import type { CompareOptions, EntryKind } from './types'

/** File extension used for saved folder snapshots. */
export const SNAPSHOT_EXT = '.juxtasnap'
/** Bumped when the on-disk snapshot format changes incompatibly. */
export const SNAPSHOT_VERSION = 1

export interface SnapshotEntry {
  relPath: string
  name: string
  kind: EntryKind
  size: number
  mtimeMs: number
  /** Raw content SHA-1 (files only). */
  hash?: string
}

export interface Snapshot {
  version: number
  /** The folder path this snapshot was captured from (for display). */
  root: string
  /** Capture time, ms since epoch. */
  capturedAt: number
  /** The options in effect at capture (used to reproduce include/exclude globs). */
  options: CompareOptions
  entries: SnapshotEntry[]
}

export function isSnapshotPath(p: string): boolean {
  return p.toLowerCase().endsWith(SNAPSHOT_EXT)
}

/** Parse and validate a snapshot file's text. Returns null if malformed. */
export function parseSnapshot(text: string): Snapshot | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const s = raw as Partial<Snapshot>
  if (s.version !== SNAPSHOT_VERSION) return null
  if (typeof s.root !== 'string' || !Array.isArray(s.entries) || !s.options) return null
  return s as Snapshot
}
