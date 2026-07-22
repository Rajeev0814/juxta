// Headless CLI invocation: `Juxta --cli <left> <right> [--out report.html|.csv]
// [--method content|sizeAndTime|quick] [--include a,b] [--exclude a,b]
// [--verbose|-v] [--quiet|-q]`.
// Parsing and report formatting are pure/testable; the main process runs the
// core engine and exits with a status code (0 = identical, 1 = differences,
// 2 = error).
import type { CompareMethod, CompareResult, DiffStatus } from './types'
import { collectChangedFiles } from './report'

export interface CliOptions {
  left: string
  right: string
  out?: string
  method?: CompareMethod
  include?: string[]
  exclude?: string[]
  /** Print only the compact machine-readable summary line (for scripts). */
  quiet?: boolean
  /** Additionally list every changed file. */
  verbose?: boolean
}

const METHODS: CompareMethod[] = ['content', 'sizeAndTime', 'quick']

function splitList(v: string | undefined): string[] | undefined {
  if (!v) return undefined
  const parts = v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  return parts.length ? parts : undefined
}

/** Parse a `--cli` invocation out of argv, or null if not a CLI run. */
export function parseCliArgs(argv: string[]): CliOptions | null {
  const i = argv.indexOf('--cli')
  if (i < 0) return null
  const rest = argv.slice(i + 1)

  const positional: string[] = []
  let out: string | undefined
  let method: string | undefined
  let include: string[] | undefined
  let exclude: string[] | undefined
  let quiet = false
  let verbose = false

  for (let j = 0; j < rest.length; j++) {
    const a = rest[j]
    if (a === '--out') out = rest[++j]
    else if (a === '--method') method = rest[++j]
    else if (a === '--include') include = splitList(rest[++j])
    else if (a === '--exclude') exclude = splitList(rest[++j])
    else if (a === '--quiet' || a === '-q') quiet = true
    else if (a === '--verbose' || a === '-v') verbose = true
    // Anything else that isn't a flag is a positional root.
    else if (!a.startsWith('-')) positional.push(a)
  }

  if (positional.length < 2) return null
  return {
    left: positional[0],
    right: positional[1],
    out,
    method: METHODS.includes(method as CompareMethod) ? (method as CompareMethod) : undefined,
    include,
    exclude,
    quiet,
    verbose
  }
}

/** Compact one-line, whitespace-delimited summary (stable for scripts to parse). */
export function machineSummaryLine(result: CompareResult): string {
  const s = result.summary
  return (
    `different=${s.different} leftOnly=${s.leftOnly} rightOnly=${s.rightOnly} ` +
    `moved=${s.moved} identical=${s.identical} files=${s.totalFiles}`
  )
}

/** Single-character tag for a changed-file status, used in the verbose listing. */
const STATUS_TAG: Record<DiffStatus, string> = {
  different: '~',
  leftOnly: '<',
  rightOnly: '>',
  identical: '='
}

export interface CliReportOptions {
  quiet?: boolean
  verbose?: boolean
}

/**
 * Format a folder-comparison result for the console. Pure.
 * - quiet:   the compact machine line only.
 * - default: a human-readable summary (roots + aligned counts + verdict).
 * - verbose: the summary plus a list of every changed file.
 */
export function formatCliReport(result: CompareResult, opts: CliReportOptions = {}): string {
  if (opts.quiet) return machineSummaryLine(result)

  const s = result.summary
  const counts: [string, number][] = [
    ['different', s.different],
    ['left only', s.leftOnly],
    ['right only', s.rightOnly],
    ['moved', s.moved],
    ['identical', s.identical],
    ['total files', s.totalFiles]
  ]
  const width = Math.max(...counts.map(([label]) => label.length))

  const lines: string[] = [
    'Juxta comparison',
    `  left:  ${result.leftRoot}`,
    `  right: ${result.rightRoot}`,
    ''
  ]
  for (const [label, n] of counts) lines.push(`  ${label.padEnd(width)}  ${n}`)

  if (opts.verbose) {
    const changed = collectChangedFiles(result)
    lines.push('')
    if (changed.length) {
      lines.push('Changed files:')
      for (const n of changed) lines.push(`  ${STATUS_TAG[n.status]} ${n.relPath}`)
    } else {
      lines.push('Changed files: none')
    }
  }

  const differs = s.different + s.leftOnly + s.rightOnly > 0
  lines.push('', differs ? 'Result: differences found' : 'Result: identical')
  return lines.join('\n')
}
