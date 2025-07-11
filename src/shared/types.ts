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
  /** Lines matching this regex are ignored when comparing file content. */
  ignoreLinePattern: string
  /** Ignore blank / whitespace-only lines when comparing file content. */
  ignoreBlankLines: boolean
  /** Compare .json files by canonical form (ignore formatting & key order). */
  normalizeJson: boolean
  /** Compare .csv/.tsv files ignoring data-row order. */
  normalizeCsv: boolean
  /** Compare .yaml/.yml files by canonical form (ignore formatting & key order). */
  normalizeYaml: boolean
  /** Compare .xml files by canonical form (ignore formatting & attribute/key order). */
  normalizeXml: boolean
  /** Compare .js/.mjs/.cjs files by AST (ignore comments, formatting & quote style). */
  normalizeCode: boolean
  /** Per-file-type overrides applied to files matching a glob (later rules win). */
  typeRules: FileTypeRule[]
}

/** A comparison override bound to files matching `glob` (e.g. "*.md", "*.min.js"). */
export interface FileTypeRule {
  glob: string
  ignoreWhitespace?: boolean
  ignoreCase?: boolean
  ignoreBlankLines?: boolean
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
  /** For a left-only file detected as renamed/moved: the right-side relPath. */
  movedTo?: string
  /** For a right-only file detected as renamed/moved: the left-side relPath. */
  movedFrom?: string
}

export interface CompareSummary {
  identical: number
  different: number
  leftOnly: number
  rightOnly: number
  /** Left-only/right-only pairs detected as the same file renamed/moved. */
  moved: number
  /** Total files (not directories) examined. */
  totalFiles: number
}

export interface MovePair {
  from: string // left-side relPath
  to: string // right-side relPath
}

/** Per-file classification of a 3-way (base / left / right) folder comparison. */
export type ThreeWayStatus =
  | 'unchanged'
  | 'modifiedLeft' // only left changed vs base
  | 'modifiedRight' // only right changed vs base
  | 'modifiedBoth' // both changed identically (also used for "dir has changes")
  | 'addedLeft'
  | 'addedRight'
  | 'addedBoth' // both added the same content
  | 'deletedLeft' // removed on the left (present in base+right)
  | 'deletedRight'
  | 'deletedBoth'
  | 'conflict' // both changed differently, or change-vs-delete, or added differently

export interface ThreeWayNode {
  name: string
  relPath: string
  kind: EntryKind
  status: ThreeWayStatus
  base?: SideInfo
  left?: SideInfo
  right?: SideInfo
  children?: ThreeWayNode[]
}

export interface ThreeWaySummary {
  unchanged: number
  modified: number
  added: number
  deleted: number
  conflicts: number
  totalFiles: number
}

export interface ThreeWayResult {
  baseRoot: string
  leftRoot: string
  rightRoot: string
  root: ThreeWayNode
  summary: ThreeWaySummary
}

export interface CompareResult {
  leftRoot: string
  rightRoot: string
  options: CompareOptions
  root: CompareNode
  summary: CompareSummary
  /** Renamed/moved file pairs (content comparisons only). */
  moves: MovePair[]
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
  useGitignore: false,
  ignoreLinePattern: '',
  ignoreBlankLines: false,
  normalizeJson: false,
  normalizeCsv: false,
  normalizeYaml: false,
  normalizeXml: false,
  normalizeCode: false,
  typeRules: []
}

export const DEFAULT_OPTIONS: CompareOptions = {
  method: 'content',
  filters: DEFAULT_FILTERS
}
