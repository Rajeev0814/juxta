export interface ArchiveEntry {
  /** Forward-slash path inside the archive (no trailing slash). */
  relPath: string
  isDir: boolean
  size: number
  /** SHA-1 of the entry's content ('' for directories). */
  hash: string
}

const ARCHIVE_RE = /\.(zip|jar|war|whl|nupkg|vsix|epub)$/i

export function isArchivePath(p: string): boolean {
  return ARCHIVE_RE.test(p)
}
