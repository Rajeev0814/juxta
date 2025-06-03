// Types shared between the Node/Electron layers and the React renderer.

export type Side = 'left' | 'right'

export type EntryKind = 'file' | 'directory'

/**
 * The comparison outcome for a single tree entry.
 *  - identical : present on both sides and considered equal
 *  - different : present on both sides but not equal
 *  - leftOnly  : exists only in the left tree
 *  - rightOnly : exists only in the right tree
 */
export type DiffStatus = 'identical' | 'different' | 'leftOnly' | 'rightOnly'

/** Which side has the newer modification time, for differing entries. */
export type Newer = 'left' | 'right' | 'same'

export type CompareMethod =
  | 'content' // hash file contents
  | 'sizeAndTime' // equal if size + mtime match
  | 'quick' // equal if size matches

export interface FilterOptions {
  /** Only entries matching at least one of these globs are included (when non-empty). */
  includeGlobs: string[]
  /** Entries matching any of these globs are excluded. */
  excludeGlobs: string[]
  /** Ignore leading/trailing/collapsed whitespace when comparing file content. */
  ignoreWhitespace: boolean
  /** Case-insensitive name matching and content comparison. */
  ignoreCase: boolean
  /** Load and apply each root's .gitignore as additional exclusions. */
  useGitignore: boolean
}

export interface CompareOptions {
  method: CompareMethod
  filters: FilterOptions
}

/** Per-side metadata for a tree entry. */
export interface SideInfo {
  path: string // absolute path on disk
  size: number
  mtimeMs: number
  hash?: string // populated for content comparisons
}

export interface CompareNode {
  name: string
  relPath: string // path relative to the compared roots, using '/'
  kind: EntryKind
  status: DiffStatus
  newer?: Newer
  left?: SideInfo
  right?: SideInfo
  children?: CompareNode[]
}

export interface CompareSummary {
  identical: number
  different: number
  leftOnly: number
  rightOnly: number
  /** Total files (not directories) examined. */
  totalFiles: number
}

export interface CompareResult {
  leftRoot: string
  rightRoot: string
  options: CompareOptions
  root: CompareNode
  summary: CompareSummary
  /** Milliseconds the comparison took. */
  elapsedMs: number
}

export interface ProgressUpdate {
  phase: 'walking' | 'hashing' | 'comparing' | 'done'
  processed: number
  total: number
  currentPath?: string
}

export const DEFAULT_FILTERS: FilterOptions = {
  includeGlobs: [],
  excludeGlobs: ['**/node_modules/**', '**/.git/**'],
  ignoreWhitespace: false,
  ignoreCase: false,
  useGitignore: false
}

export const DEFAULT_OPTIONS: CompareOptions = {
  method: 'content',
  filters: DEFAULT_FILTERS
}
