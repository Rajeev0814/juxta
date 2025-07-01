// Parse and apply unified diffs (the `--- / +++ / @@` format produced by
// toUnifiedDiff). Pure and renderer-safe. Application is content-based — it
// locates each hunk by matching its context/removed lines rather than trusting
// the header line numbers — so it tolerates a patch whose offsets have drifted.
import { toLines } from './blocks'

type PatchLineKind = 'context' | 'add' | 'del'

interface PatchLine {
  kind: PatchLineKind
  text: string
}

export interface Hunk {
  oldStart: number
  oldLen: number
  newStart: number
  newLen: number
  lines: PatchLine[]
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/** Parse a unified diff into hunks. Returns null if it contains no hunks. */
export function parseUnifiedDiff(patch: string): Hunk[] | null {
  const raw = toLines(patch)
  const hunks: Hunk[] = []
  let cur: Hunk | null = null

  for (let idx = 0; idx < raw.length; idx++) {
    const line = raw[idx]
    if (line.startsWith('--- ') || line.startsWith('+++ ')) continue
    const m = HUNK_RE.exec(line)
    if (m) {
      cur = {
        oldStart: Number(m[1]),
        oldLen: m[2] === undefined ? 1 : Number(m[2]),
        newStart: Number(m[3]),
        newLen: m[4] === undefined ? 1 : Number(m[4]),
        lines: []
      }
      hunks.push(cur)
      continue
    }
    if (!cur) continue // preamble before the first hunk
    if (line.startsWith('\\')) continue // "\ No newline at end of file"
    const c = line[0]
    if (c === ' ') cur.lines.push({ kind: 'context', text: line.slice(1) })
    else if (c === '-') cur.lines.push({ kind: 'del', text: line.slice(1) })
    else if (c === '+') cur.lines.push({ kind: 'add', text: line.slice(1) })
    // A bare '' (e.g. the trailing newline after join) or any other line is
    // ignored — every real body line carries a ' ', '-' or '+' prefix.
  }

  return hunks.length > 0 ? hunks : null
}

export interface ApplyResult {
  text: string
  /** Total hunks in the patch. */
  hunks: number
  /** Hunks successfully applied. */
  applied: number
  /** Hunks that could not be located and were skipped. */
  failed: number
}

/** The old-side lines a hunk expects to find (context + removed, in order). */
function oldSequence(h: Hunk): string[] {
  return h.lines.filter((l) => l.kind !== 'add').map((l) => l.text)
}

function matchesAt(src: string[], seq: string[], at: number): boolean {
  if (at < 0 || at + seq.length > src.length) return false
  for (let i = 0; i < seq.length; i++) if (src[at + i] !== seq[i]) return false
  return true
}

/** Find where a hunk's old-side block sits in `src`, at or after `from`. */
function locateHunk(src: string[], h: Hunk, from: number): number {
  const seq = oldSequence(h)
  const hint = h.oldStart - 1
  if (seq.length === 0) return Math.max(from, Math.min(hint, src.length))
  if (hint >= from && matchesAt(src, seq, hint)) return hint
  for (let at = from; at + seq.length <= src.length; at++) {
    if (matchesAt(src, seq, at)) return at
  }
  return -1
}

/**
 * Apply a unified diff to `original`. Hunks that don't match are skipped (the
 * rest still apply), and the counts are reported. Returns null if `patch` isn't
 * a unified diff at all.
 */
export function applyUnifiedDiff(original: string, patch: string): ApplyResult | null {
  const hunks = parseUnifiedDiff(patch)
  if (!hunks) return null

  const src = toLines(original)
  const out: string[] = []
  let cursor = 0
  let applied = 0
  let failed = 0

  for (const h of hunks) {
    const target = locateHunk(src, h, cursor)
    if (target < 0) {
      failed++
      continue
    }
    for (let k = cursor; k < target; k++) out.push(src[k])
    cursor = target
    for (const line of h.lines) {
      if (line.kind === 'context') {
        out.push(src[cursor])
        cursor++
      } else if (line.kind === 'del') {
        cursor++
      } else {
        out.push(line.text)
      }
    }
    applied++
  }
  for (let k = cursor; k < src.length; k++) out.push(src[k])

  return { text: out.join('\n'), hunks: hunks.length, applied, failed }
}
