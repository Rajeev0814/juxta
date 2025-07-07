import { createHash } from 'node:crypto'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import type { ArchiveEntry } from '../shared/archive'
import type { WalkEntry } from './walk'
import { isTarPath } from '../shared/archive'
import { readTarEntries, readTarEntryData } from './tar'

export type { ArchiveEntry } from '../shared/archive'
export { isArchivePath } from '../shared/archive'

/** Read any supported archive's entries (zip-family via adm-zip, tar-family via the tar reader). */
export function readArchiveEntries(archivePath: string): ArchiveEntry[] {
  return isTarPath(archivePath) ? readTarEntries(archivePath) : readZipEntries(archivePath)
}

/** Read one entry's raw bytes from a .zip-family archive (null if absent). */
export function readZipEntryData(zipPath: string, relPath: string): Buffer | null {
  const entry = new AdmZip(zipPath).getEntry(relPath)
  return entry && !entry.isDirectory ? entry.getData() : null
}

/** Read a single entry's raw bytes from any supported archive (null if absent). */
export function readArchiveEntryData(archivePath: string, relPath: string): Buffer | null {
  return isTarPath(archivePath) ? readTarEntryData(archivePath, relPath) : readZipEntryData(archivePath, relPath)
}

/** Read a .zip file's entries with content hashes (for comparison). */
export function readZipEntries(zipPath: string): ArchiveEntry[] {
  const zip = new AdmZip(zipPath)
  return zip.getEntries().map((e) => {
    if (e.isDirectory) {
      return { relPath: e.entryName.replace(/\/+$/, ''), isDir: true, size: 0, hash: '' }
    }
    const data = e.getData()
    return {
      relPath: e.entryName,
      isDir: false,
      size: data.length,
      hash: createHash('sha1').update(data).digest('hex')
    }
  })
}

/**
 * Convert archive entries into WalkEntry objects (files carry their SHA-1, so
 * the compare engine never touches disk for this side) with directory entries
 * synthesized for every ancestor path — matching what walkTree would produce.
 */
export function archiveToWalkEntries(entries: ArchiveEntry[], archivePath: string): WalkEntry[] {
  const map = new Map<string, WalkEntry>()

  const addDir = (relPath: string): void => {
    if (!relPath || map.has(relPath)) return
    map.set(relPath, {
      relPath,
      name: relPath.slice(relPath.lastIndexOf('/') + 1),
      kind: 'directory',
      path: join(archivePath, relPath),
      size: 0,
      mtimeMs: 0
    })
  }
  const addAncestors = (relPath: string): void => {
    const parts = relPath.split('/')
    parts.pop()
    let acc = ''
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p
      addDir(acc)
    }
  }

  for (const e of entries) {
    const rel = e.relPath.replace(/\/+$/, '')
    if (!rel) continue
    addAncestors(rel)
    if (e.isDir) {
      addDir(rel)
      continue
    }
    map.set(rel, {
      relPath: rel,
      name: rel.slice(rel.lastIndexOf('/') + 1),
      kind: 'file',
      path: join(archivePath, rel),
      size: e.size,
      mtimeMs: 0,
      hash: e.hash
    })
  }

  return [...map.values()]
}
