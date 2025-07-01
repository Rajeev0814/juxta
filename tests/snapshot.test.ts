import { describe, expect, it } from 'vitest'
import { compareFolders } from '../src/core/compare'
import { captureSnapshot, snapshotCompareOptions, snapshotToWalkEntries } from '../src/core/snapshot'
import { isSnapshotPath, parseSnapshot, SNAPSHOT_VERSION } from '../src/shared/snapshot'
import { DEFAULT_FILTERS, type CompareOptions } from '../src/shared/types'
import { makeTree } from './helpers'

const options: CompareOptions = { method: 'content', filters: { ...DEFAULT_FILTERS, excludeGlobs: [] } }

describe('isSnapshotPath', () => {
  it('matches the .juxtasnap extension case-insensitively', () => {
    expect(isSnapshotPath('backup.juxtasnap')).toBe(true)
    expect(isSnapshotPath('C:/x/State.JUXTASNAP')).toBe(true)
    expect(isSnapshotPath('notes.txt')).toBe(false)
  })
})

describe('parseSnapshot', () => {
  it('round-trips a captured snapshot and rejects malformed input', async () => {
    const root = await makeTree({ 'a.txt': 'one', 'sub/b.txt': 'two' })
    const snap = await captureSnapshot(root, options, () => 1000)
    const parsed = parseSnapshot(JSON.stringify(snap))
    expect(parsed?.version).toBe(SNAPSHOT_VERSION)
    expect(parsed?.capturedAt).toBe(1000)
    expect(parsed?.entries.length).toBe(snap.entries.length)

    expect(parseSnapshot('{not json}')).toBeNull()
    expect(parseSnapshot(JSON.stringify({ version: 999 }))).toBeNull()
  })
})

describe('captureSnapshot', () => {
  it('records files with content hashes and directories without', async () => {
    const root = await makeTree({ 'a.txt': 'hello', 'dir/c.txt': 'x' })
    const snap = await captureSnapshot(root, options, () => 0)
    const file = snap.entries.find((e) => e.relPath === 'a.txt')
    const dir = snap.entries.find((e) => e.relPath === 'dir')
    expect(file?.kind).toBe('file')
    expect(file?.hash).toMatch(/^[0-9a-f]{40}$/)
    expect(dir?.kind).toBe('directory')
    expect(dir?.hash).toBeUndefined()
  })
})

describe('compare against a snapshot', () => {
  it('classifies changed / added / removed files without the original folder', async () => {
    const orig = await makeTree({ 'a.txt': '1', 'b.txt': '2', 'c.txt': '3' })
    const snap = await captureSnapshot(orig, options, () => 0)

    // A different live folder: b changed, c removed, d added; a unchanged.
    const live = await makeTree({ 'a.txt': '1', 'b.txt': 'CHANGED', 'd.txt': '4' })

    const result = await compareFolders({
      leftRoot: live,
      rightRoot: '(snapshot)',
      options: snapshotCompareOptions(snap),
      rightEntries: snapshotToWalkEntries(snap)
    })

    expect(result.summary.identical).toBe(1) // a
    expect(result.summary.different).toBe(1) // b
    expect(result.summary.leftOnly).toBe(1) // d (only in live/left)
    expect(result.summary.rightOnly).toBe(1) // c (only in snapshot/right)
  })
})
