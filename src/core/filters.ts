import picomatch from 'picomatch'
import type { FilterOptions } from '../shared/types'
import type { IgnoreMatcher } from './ignore'

export interface Matcher {
  /**
   * Returns true if a relative path should be included in the comparison.
   * `relPath` uses forward slashes. `isDir` lets directory-only globs work.
   */
  shouldInclude(relPath: string, isDir: boolean): boolean
}

function compileGlobs(globs: string[], ignoreCase: boolean): ((p: string) => boolean) | null {
  const cleaned = globs.map((g) => g.trim()).filter(Boolean)
  if (cleaned.length === 0) return null
  // picomatch accepts an array of patterns and matches if ANY pattern matches.
  const isMatch = picomatch(cleaned, { dot: true, nocase: ignoreCase })
  return (p: string) => isMatch(p)
}

/**
 * Some users write excludes like "node_modules/" or "*.log" rather than full
 * glob paths. Expand those shorthands into globs that match anywhere in the tree.
 */
export function normalizeGlob(pattern: string): string[] {
  const p = pattern.trim().replace(/\\/g, '/')
  if (!p) return []
  const out = new Set<string>([p])
  if (p.endsWith('/')) {
    // directory shorthand: "node_modules/" -> match the dir and its contents anywhere
    const base = p.slice(0, -1)
    out.add(`**/${base}`)
    out.add(`**/${base}/**`)
    out.add(`${base}/**`)
  } else if (!p.includes('/')) {
    // bare name or extension glob: "*.log" -> match at any depth
    out.add(`**/${p}`)
  }
  return [...out]
}

function expandAll(globs: string[]): string[] {
  return globs.flatMap(normalizeGlob)
}

export function createMatcher(filters: FilterOptions): Matcher {
  const include = compileGlobs(expandAll(filters.includeGlobs), filters.ignoreCase)
  const exclude = compileGlobs(expandAll(filters.excludeGlobs), filters.ignoreCase)

  return {
    shouldInclude(relPath: string): boolean {
      if (exclude && exclude(relPath)) return false
      // Include filters only constrain files; a directory is kept so we can
      // recurse into it and discover matching files inside.
      if (include && !include(relPath)) {
        return false
      }
      return true
    }
  }
}

/**
 * Directories must always be traversable even when an include filter is set,
 * otherwise we would never reach the matching files inside them. This matcher
 * is used while walking: excludes still prune, but includes are deferred to files.
 */
export function createWalkMatcher(filters: FilterOptions, ignore?: IgnoreMatcher): Matcher {
  const include = compileGlobs(expandAll(filters.includeGlobs), filters.ignoreCase)
  const exclude = compileGlobs(expandAll(filters.excludeGlobs), filters.ignoreCase)

  return {
    shouldInclude(relPath: string, isDir: boolean): boolean {
      if (exclude && exclude(relPath)) return false
      if (ignore && ignore.ignores(relPath, isDir)) return false
      if (isDir) return true // always descend; files are filtered individually
      if (include && !include(relPath)) return false
      return true
    }
  }
}
