// Headless CLI invocation: `Juxta --cli <left> <right> [--out report.html|.csv]
// [--method content|sizeAndTime|quick] [--include a,b] [--exclude a,b]`.
// Parsing is pure/testable; the main process runs the core engine and exits with
// a status code (0 = identical, 1 = differences, 2 = error).
import type { CompareMethod } from './types'

export interface CliOptions {
  left: string
  right: string
  out?: string
  method?: CompareMethod
  include?: string[]
  exclude?: string[]
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

  for (let j = 0; j < rest.length; j++) {
    const a = rest[j]
    if (a === '--out') out = rest[++j]
    else if (a === '--method') method = rest[++j]
    else if (a === '--include') include = splitList(rest[++j])
    else if (a === '--exclude') exclude = splitList(rest[++j])
    else if (!a.startsWith('--')) positional.push(a)
  }

  if (positional.length < 2) return null
  return {
    left: positional[0],
    right: positional[1],
    out,
    method: METHODS.includes(method as CompareMethod) ? (method as CompareMethod) : undefined,
    include,
    exclude
  }
}
