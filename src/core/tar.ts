// Minimal tar (and tar.gz) reader — enough to list entries with content hashes
// for comparison. Pure Node (zlib is built in), so no dependency is added.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import type { ArchiveEntry } from '../shared/archive'

const BLOCK = 512

/** Read a NUL/space-terminated octal field. */
function readOctal(block: Buffer, start: number, len: number): number {
  const s = block.toString('ascii', start, start + len).replace(/[\0 ].*$/s, '').trim()
  return s ? parseInt(s, 8) : 0
}

/** Read a NUL-terminated string field. */
function readStr(block: Buffer, start: number, len: number): string {
  return block.toString('utf8', start, start + len).replace(/\0.*$/s, '')
}

interface TarEntry {
  relPath: string
  isDir: boolean
  size: number
  content: Buffer
}

/** Iterate the entries of a tar/tgz file, invoking `cb` per real entry. */
function forEachTarEntry(tarPath: string, cb: (entry: TarEntry) => void): void {
  let data = readFileSync(tarPath)
  if (/\.(tgz|gz)$/i.test(tarPath)) data = gunzipSync(data)

  let offset = 0
  let longName: string | null = null

  while (offset + BLOCK <= data.length) {
    const header = data.subarray(offset, offset + BLOCK)
    // Two consecutive zero blocks mark the end of the archive.
    if (header.every((b) => b === 0)) break

    let name = readStr(header, 0, 100)
    const prefix = readStr(header, 345, 155)
    if (prefix) name = `${prefix}/${name}`
    const size = readOctal(header, 124, 12)
    const typeflag = String.fromCharCode(header[156]) || '0'
    const dataStart = offset + BLOCK
    const advance = dataStart + Math.ceil(size / BLOCK) * BLOCK

    if (typeflag === 'L') {
      // GNU long name: this entry's data holds the real name of the next entry.
      longName = readStr(data.subarray(dataStart, dataStart + size), 0, size)
      offset = advance
      continue
    }
    if (longName) {
      name = longName
      longName = null
    }

    // Skip pax extended-header records ('x'/'g') — metadata, not real entries.
    if (typeflag !== 'x' && typeflag !== 'g') {
      const rel = name.replace(/\/+$/, '')
      if (rel) {
        const isDir = typeflag === '5' || name.endsWith('/')
        cb({ relPath: rel, isDir, size, content: isDir ? Buffer.alloc(0) : data.subarray(dataStart, dataStart + size) })
      }
    }
    offset = advance
  }
}

/** List the entries of a .tar / .tar.gz / .tgz file with SHA-1 content hashes. */
export function readTarEntries(tarPath: string): ArchiveEntry[] {
  const entries: ArchiveEntry[] = []
  forEachTarEntry(tarPath, (e) => {
    entries.push(
      e.isDir
        ? { relPath: e.relPath, isDir: true, size: 0, hash: '' }
        : { relPath: e.relPath, isDir: false, size: e.size, hash: createHash('sha1').update(e.content).digest('hex') }
    )
  })
  return entries
}

/** Read a single entry's raw bytes from a tar/tgz file (null if absent). */
export function readTarEntryData(tarPath: string, relPath: string): Buffer | null {
  let found: Buffer | null = null
  forEachTarEntry(tarPath, (e) => {
    if (!e.isDir && e.relPath === relPath && found === null) found = Buffer.from(e.content)
  })
  return found
}
