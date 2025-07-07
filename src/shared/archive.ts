export interface ArchiveEntry {
  /** Forward-slash path inside the archive (no trailing slash). */
  relPath: string
  isDir: boolean
  size: number
  /** SHA-1 of the entry's content ('' for directories). */
  hash: string
}

const ARCHIVE_RE = /\.(zip|jar|war|whl|nupkg|vsix|epub|tar|tgz|tar\.gz)$/i

export function isArchivePath(p: string): boolean {
  return ARCHIVE_RE.test(p)
}

/** True for tar-family archives (read via the tar reader, not adm-zip). */
export function isTarPath(p: string): boolean {
  return /\.(tar|tgz|tar\.gz)$/i.test(p)
}
