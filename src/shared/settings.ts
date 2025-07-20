import {
  DEFAULT_OPTIONS,
  type CompareMethod,
  type CompareOptions,
  type FileTypeRule,
  type FilterOptions
} from './types'
import { createSession, type Session, type SessionType } from './session'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface CompareProfile {
  name: string
  options: CompareOptions
}

/** Comparison options remembered for (pinned to) a specific folder pair. */
export interface ProjectScope {
  left: string
  right: string
  options: CompareOptions
}

export interface PersistedSettings {
  sessions: Session[]
  activeSessionId: string
  theme: 'light' | 'dark'
  hideIdentical: boolean
  useTrash: boolean
  windowBounds: WindowBounds | null
  profiles: CompareProfile[]
  projectScopes: ProjectScope[]
}

export function defaultSettings(): PersistedSettings {
  const first = createSession('folders', 'session-0')
  return {
    sessions: [first],
    activeSessionId: first.id,
    theme: 'dark',
    hideIdentical: false,
    useTrash: true,
    windowBounds: null,
    profiles: [],
    projectScopes: []
  }
}

/** Kept for tests / convenience; always read a fresh copy via defaultSettings(). */
export const DEFAULT_SETTINGS = defaultSettings()

const METHODS: CompareMethod[] = ['content', 'sizeAndTime', 'quick']
const TYPES: SessionType[] = ['folders', 'files', 'text', 'folders3']

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function stringArray(v: unknown, fallback: string[]): string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : fallback
}

function coerceTypeRules(raw: unknown): FileTypeRule[] {
  if (!Array.isArray(raw)) return []
  const rules: FileTypeRule[] = []
  for (const r of raw) {
    if (!isObject(r) || typeof r.glob !== 'string' || !r.glob.trim()) continue
    const rule: FileTypeRule = { glob: r.glob }
    if (typeof r.ignoreWhitespace === 'boolean') rule.ignoreWhitespace = r.ignoreWhitespace
    if (typeof r.ignoreCase === 'boolean') rule.ignoreCase = r.ignoreCase
    if (typeof r.ignoreBlankLines === 'boolean') rule.ignoreBlankLines = r.ignoreBlankLines
    rules.push(rule)
  }
  return rules
}

function coerceFilters(raw: unknown): FilterOptions {
  const d = DEFAULT_OPTIONS.filters
  if (!isObject(raw)) return { ...d }
  return {
    includeGlobs: stringArray(raw.includeGlobs, d.includeGlobs),
    excludeGlobs: stringArray(raw.excludeGlobs, d.excludeGlobs),
    ignoreWhitespace: typeof raw.ignoreWhitespace === 'boolean' ? raw.ignoreWhitespace : d.ignoreWhitespace,
    ignoreCase: typeof raw.ignoreCase === 'boolean' ? raw.ignoreCase : d.ignoreCase,
    useGitignore: typeof raw.useGitignore === 'boolean' ? raw.useGitignore : d.useGitignore,
    ignoreLinePattern: typeof raw.ignoreLinePattern === 'string' ? raw.ignoreLinePattern : d.ignoreLinePattern,
    ignoreBlankLines: typeof raw.ignoreBlankLines === 'boolean' ? raw.ignoreBlankLines : d.ignoreBlankLines,
    normalizeJson: typeof raw.normalizeJson === 'boolean' ? raw.normalizeJson : d.normalizeJson,
    normalizeCsv: typeof raw.normalizeCsv === 'boolean' ? raw.normalizeCsv : d.normalizeCsv,
    normalizeYaml: typeof raw.normalizeYaml === 'boolean' ? raw.normalizeYaml : d.normalizeYaml,
    normalizeXml: typeof raw.normalizeXml === 'boolean' ? raw.normalizeXml : d.normalizeXml,
    normalizeCode: typeof raw.normalizeCode === 'boolean' ? raw.normalizeCode : d.normalizeCode,
    typeRules: coerceTypeRules(raw.typeRules)
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

function coerceSession(raw: unknown): Session | null {
  if (!isObject(raw)) return null
  const type = raw.type
  if (!TYPES.includes(type as SessionType)) return null
  return {
    id: str(raw.id),
    type: type as SessionType,
    leftRoot: str(raw.leftRoot),
    rightRoot: str(raw.rightRoot),
    baseRoot: str(raw.baseRoot),
    options: coerceOptions(raw.options),
    leftFile: str(raw.leftFile),
    rightFile: str(raw.rightFile),
    leftText: str(raw.leftText),
    rightText: str(raw.rightText)
  }
}

function coerceProfiles(raw: unknown): CompareProfile[] {
  if (!Array.isArray(raw)) return []
  const out: CompareProfile[] = []
  for (const p of raw) {
    if (isObject(p) && typeof p.name === 'string' && p.name) {
      out.push({ name: p.name, options: coerceOptions(p.options) })
    }
  }
  return out
}

function coerceProjectScopes(raw: unknown): ProjectScope[] {
  if (!Array.isArray(raw)) return []
  const out: ProjectScope[] = []
  for (const p of raw) {
    if (isObject(p) && typeof p.left === 'string' && typeof p.right === 'string' && p.left && p.right) {
      out.push({ left: p.left, right: p.right, options: coerceOptions(p.options) })
    }
  }
  return out
}

function coerceBounds(raw: unknown): WindowBounds | null {
  if (!isObject(raw)) return null
  const { x, y, width, height } = raw
  if (
    [x, y, width, height].every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    (width as number) > 0 &&
    (height as number) > 0
  ) {
    return { x: x as number, y: y as number, width: width as number, height: height as number }
  }
  return null
}

/**
 * Build fully-valid settings from arbitrary parsed JSON, falling back to
 * defaults for anything missing or malformed. Ensures at least one session
 * with unique ids and a valid active id. Never throws.
 */
export function coerceSettings(raw: unknown): PersistedSettings {
  const s = defaultSettings()
  if (!isObject(raw)) return s

  if (Array.isArray(raw.sessions)) {
    const list = raw.sessions.map(coerceSession).filter((x): x is Session => x !== null)
    if (list.length > 0) {
      const seen = new Set<string>()
      list.forEach((sess, i) => {
        if (!sess.id || seen.has(sess.id)) sess.id = `session-${i}`
        seen.add(sess.id)
      })
      s.sessions = list
      s.activeSessionId = list[0].id
    }
  }

  if (typeof raw.activeSessionId === 'string' && s.sessions.some((x) => x.id === raw.activeSessionId)) {
    s.activeSessionId = raw.activeSessionId
  }
  if (raw.theme === 'light' || raw.theme === 'dark') s.theme = raw.theme
  if (typeof raw.hideIdentical === 'boolean') s.hideIdentical = raw.hideIdentical
  if (typeof raw.useTrash === 'boolean') s.useTrash = raw.useTrash
  s.windowBounds = coerceBounds(raw.windowBounds)
  s.profiles = coerceProfiles(raw.profiles)
  s.projectScopes = coerceProjectScopes(raw.projectScopes)
  return s
}
