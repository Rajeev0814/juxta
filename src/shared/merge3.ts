import { matchingBlocks, toLines } from './blocks'

// Line-level 3-way merge (diff3-style). Auto-merges non-overlapping changes
// from each side against a common base; emits git-style conflict markers where
// both sides changed the same region differently. Pure and heavily tested —
// correctness matters because this feeds git mergetool.

interface SideRegion {
  baseStart: number
  baseEnd: number
  otherStart: number
  otherEnd: number
}

/** Regions where `other` differs from `base` (half-open ranges). */
function diffRegions(base: string[], other: string[]): SideRegion[] {
  const mb = matchingBlocks(base, other)
  mb.push({ aStart: base.length, bStart: other.length, len: 0 }) // sentinel
  const out: SideRegion[] = []
  let bi = 0
  let oi = 0
  for (const m of mb) {
    if (m.aStart > bi || m.bStart > oi) {
      out.push({ baseStart: bi, baseEnd: m.aStart, otherStart: oi, otherEnd: m.bStart })
    }
    bi = m.aStart + m.len
    oi = m.bStart + m.len
  }
  return out
}

interface Hunk {
  oStart: number
  oEnd: number
  side: 0 | 1 // 0 = local, 1 = remote
  sStart: number
  sEnd: number
}

/**
 * Content of one side over the base region [rs, re): the side's changed lines
 * where its hunks apply, and the base lines (unchanged on that side) elsewhere.
 */
function sideContent(rs: number, re: number, hunks: Hunk[], base: string[], side: string[]): string[] {
  const out: string[] = []
  let pos = rs
  for (const h of hunks) {
    for (let k = pos; k < h.oStart; k++) out.push(base[k])
    for (let k = h.sStart; k < h.sEnd; k++) out.push(side[k])
    pos = h.oEnd
  }
  for (let k = pos; k < re; k++) out.push(base[k])
  return out
}

function eq(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

export interface Merge3Options {
  localLabel?: string
  remoteLabel?: string
}

export interface Merge3Result {
  merged: string
  conflicts: number
}

export function merge3(
  baseText: string,
  localText: string,
  remoteText: string,
  options: Merge3Options = {}
): Merge3Result {
  const base = toLines(baseText)
  const local = toLines(localText)
  const remote = toLines(remoteText)
  const localLabel = options.localLabel ?? 'LOCAL'
  const remoteLabel = options.remoteLabel ?? 'REMOTE'

  const hunks: Hunk[] = []
  for (const r of diffRegions(base, local)) {
    hunks.push({ oStart: r.baseStart, oEnd: r.baseEnd, side: 0, sStart: r.otherStart, sEnd: r.otherEnd })
  }
  for (const r of diffRegions(base, remote)) {
    hunks.push({ oStart: r.baseStart, oEnd: r.baseEnd, side: 1, sStart: r.otherStart, sEnd: r.otherEnd })
  }
  hunks.sort((x, y) => x.oStart - y.oStart || x.side - y.side)

  const out: string[] = []
  let conflicts = 0
  let oi = 0
  let i = 0
  while (i < hunks.length) {
    const rs = hunks[i].oStart
    let re = hunks[i].oEnd
    const group: Hunk[] = [hunks[i]]
    i++
    while (i < hunks.length && hunks[i].oStart <= re) {
      re = Math.max(re, hunks[i].oEnd)
      group.push(hunks[i])
      i++
    }
    for (let k = oi; k < rs; k++) out.push(base[k]) // stable region

    const localC = sideContent(rs, re, group.filter((h) => h.side === 0), base, local)
    const remoteC = sideContent(rs, re, group.filter((h) => h.side === 1), base, remote)
    const baseC = base.slice(rs, re)

    if (eq(localC, baseC)) out.push(...remoteC) // only remote changed
    else if (eq(remoteC, baseC)) out.push(...localC) // only local changed
    else if (eq(localC, remoteC)) out.push(...localC) // both changed identically
    else {
      conflicts++
      out.push(`<<<<<<< ${localLabel}`, ...localC, '=======', ...remoteC, `>>>>>>> ${remoteLabel}`)
    }
    oi = re
  }
  for (let k = oi; k < base.length; k++) out.push(base[k])

  return { merged: out.join('\n'), conflicts }
}
