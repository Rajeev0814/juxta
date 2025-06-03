import {
  DEFAULT_OPTIONS,
  type CompareMethod,
  type CompareOptions,
  type FilterOptions
} from './types'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface PersistedSettings {
  leftRoot: string
  rightRoot: string
  leftFile: string
  rightFile: string
  options: CompareOptions
  theme: 'light' | 'dark'
  mode: 'folders' | 'files'
  hideIdentical: boolean
  useTrash: boolean
  windowBounds: WindowBounds | null
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  leftRoot: '',
  rightRoot: '',
  leftFile: '',
  rightFile: '',
  options: DEFAULT_OPTIONS,
  theme: 'dark',
  mode: 'folders',
  hideIdentical: false,
  useTrash: true,
  windowBounds: null
}

const METHODS: CompareMethod[] = ['content', 'sizeAndTime', 'quick']

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function stringArray(v: unknown, fallback: string[]): string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : fallback
}

function coerceFilters(raw: unknown): FilterOptions {
  const d = DEFAULT_OPTIONS.filters
  if (!isObject(raw)) return { ...d }
  return {
    includeGlobs: stringArray(raw.includeGlobs, d.includeGlobs),
    excludeGlobs: stringArray(raw.excludeGlobs, d.excludeGlobs),
    ignoreWhitespace: typeof raw.ignoreWhitespace === 'boolean' ? raw.ignoreWhitespace : d.ignoreWhitespace,
    ignoreCase: typeof raw.ignoreCase === 'boolean' ? raw.ignoreCase : d.ignoreCase,
    useGitignore: typeof raw.useGitignore === 'boolean' ? raw.useGitignore : d.useGitignore
  }
}

function coerceOptions(raw: unknown): CompareOptions {
  if (!isObject(raw)) return { ...DEFAULT_OPTIONS }
  const method =
    typeof raw.method === 'string' && METHODS.includes(raw.method as CompareMethod)
      ? (raw.method as CompareMethod)
      : DEFAULT_OPTIONS.method
  return { method, filters: coerceFilters(raw.filters) }
}

function coerceBounds(raw: unknown): WindowBounds | null {
  if (!isObject(raw)) return null
  const { x, y, width, height } = raw
  if ([x, y, width, height].every((n) => typeof n === 'number' && Number.isFinite(n)) && (width as number) > 0 && (height as number) > 0) {
    return { x: x as number, y: y as number, width: width as number, height: height as number }
  }
  return null
}

/**
 * Build a fully-valid settings object from arbitrary parsed JSON, falling back
 * to defaults for any missing or malformed field. Never throws.
 */
export function coerceSettings(raw: unknown): PersistedSettings {
  if (!isObject(raw)) return { ...DEFAULT_SETTINGS, options: { ...DEFAULT_OPTIONS } }
  const s: PersistedSettings = { ...DEFAULT_SETTINGS }
  if (typeof raw.leftRoot === 'string') s.leftRoot = raw.leftRoot
  if (typeof raw.rightRoot === 'string') s.rightRoot = raw.rightRoot
  if (typeof raw.leftFile === 'string') s.leftFile = raw.leftFile
  if (typeof raw.rightFile === 'string') s.rightFile = raw.rightFile
  s.options = coerceOptions(raw.options)
  if (raw.theme === 'light' || raw.theme === 'dark') s.theme = raw.theme
  if (raw.mode === 'folders' || raw.mode === 'files') s.mode = raw.mode
  if (typeof raw.hideIdentical === 'boolean') s.hideIdentical = raw.hideIdentical
  if (typeof raw.useTrash === 'boolean') s.useTrash = raw.useTrash
  s.windowBounds = coerceBounds(raw.windowBounds)
  return s
}
