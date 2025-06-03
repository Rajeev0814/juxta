import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { EntryKind } from '../shared/types'
import type { Matcher } from './filters'

export interface WalkEntry {
  relPath: string // forward-slash relative path
  name: string
  kind: EntryKind
  path: string // absolute
  size: number
  mtimeMs: number
  hash?: string // populated lazily during content comparison
}

export interface WalkOptions {
  matcher: Matcher
  onEntry?: (count: number, currentPath: string) => void
}

/**
 * Recursively walk a directory tree, yielding files and directories that pass
 * the matcher. Symlinks are not followed (avoids cycles). Unreadable entries
 * are skipped rather than aborting the whole walk.
 */
export async function walkTree(root: string, options: WalkOptions): Promise<WalkEntry[]> {
  const entries: WalkEntry[] = []
  let count = 0

  async function recurse(absDir: string, relDir: string): Promise<void> {
    let dirents
    try {
      dirents = await readdir(absDir, { withFileTypes: true })
    } catch {
      return // unreadable directory — skip
    }
    // Sort for stable, deterministic output.
    dirents.sort((a, b) => a.name.localeCompare(b.name))

    for (const dirent of dirents) {
      const relPath = relDir ? `${relDir}/${dirent.name}` : dirent.name
      const absPath = join(absDir, dirent.name)
      const isDir = dirent.isDirectory()

      if (dirent.isSymbolicLink()) continue
      if (!isDir && !dirent.isFile()) continue // skip sockets, fifos, devices

      if (!options.matcher.shouldInclude(relPath, isDir)) continue

      let info
      try {
        info = await stat(absPath)
      } catch {
        continue
      }

      count++
      options.onEntry?.(count, absPath)

      if (isDir) {
        entries.push({
          relPath,
          name: dirent.name,
          kind: 'directory',
          path: absPath,
          size: 0,
          mtimeMs: info.mtimeMs
        })
        await recurse(absPath, relPath)
      } else {
        entries.push({
          relPath,
          name: dirent.name,
          kind: 'file',
          path: absPath,
          size: info.size,
          mtimeMs: info.mtimeMs
        })
      }
    }
  }

  await recurse(root, '')
  return entries
}
