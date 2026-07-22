// User-configured "format converter" plugins: map a set of file extensions to
// an external command that converts a file to plain text on stdout, so Juxta
// can text-compare file types it doesn't natively understand (e.g. .rtf, .doc,
// .ipynb). The command is user-provided — the same trust model as a git
// difftool — and the main process spawns it directly (no shell), substituting
// the file path for a `${file}` token in the argument list. This module is
// pure/testable; the main process owns the actual spawn.

export interface FormatConverter {
  /** Display name, shown in the compare view's title bar. */
  name: string
  /** File extensions (without the dot, case-insensitive) this converter handles. */
  extensions: string[]
  /** Executable to run (resolved on PATH, or an absolute path). */
  command: string
  /** Arguments; a literal `${file}` token is replaced with the file path. */
  args: string[]
}

const FILE_TOKEN = '${file}'

/** Lowercase extension of a path without the dot, or '' if none. */
export function extensionOf(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

/** Validate/normalize arbitrary parsed JSON into a converter list. Never throws. */
export function coerceConverters(raw: unknown): FormatConverter[] {
  if (!Array.isArray(raw)) return []
  const out: FormatConverter[] = []
  for (const c of raw) {
    if (typeof c !== 'object' || c === null) continue
    const o = c as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    const command = typeof o.command === 'string' ? o.command.trim() : ''
    const extensions = Array.isArray(o.extensions)
      ? o.extensions
          .filter((e): e is string => typeof e === 'string')
          .map((e) => e.replace(/^\./, '').trim().toLowerCase())
          .filter(Boolean)
      : []
    const args = Array.isArray(o.args) ? o.args.filter((a): a is string => typeof a === 'string') : []
    if (!name || !command || extensions.length === 0) continue
    out.push({ name, command, extensions, args })
  }
  return out
}

/** The first converter whose extensions include this path's extension, or null. */
export function findConverter(converters: FormatConverter[], path: string): FormatConverter | null {
  const ext = extensionOf(path)
  if (!ext) return null
  return converters.find((c) => c.extensions.includes(ext)) ?? null
}

/**
 * Resolve the command + args to run for a file: substitute the `${file}` token
 * with the path, or append the path as a final argument when no token is
 * present. Pure — no spawning here.
 */
export function buildConverterInvocation(
  conv: FormatConverter,
  filePath: string
): { command: string; args: string[] } {
  const hasToken = conv.args.some((a) => a.includes(FILE_TOKEN))
  const args = hasToken
    ? conv.args.map((a) => a.split(FILE_TOKEN).join(filePath))
    : [...conv.args, filePath]
  return { command: conv.command, args }
}
