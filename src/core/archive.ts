import { createHash } from 'node:crypto'
import AdmZip from 'adm-zip'
import type { ArchiveEntry } from '../shared/archive'

export type { ArchiveEntry } from '../shared/archive'
export { isArchivePath } from '../shared/archive'

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
