// Line-level structural diff used for section (block) level merge in the file
// view. Kept pure and dependency-free so it can be unit-tested in isolation and
// so the merge math is fully under our control (no reliance on the editor's
// internal change encoding, which is easy to mis-handle and would corrupt files).

export type Side = 'left' | 'right'

export interface MergeBlock {
  /** true when the two sides differ within this block. */
  changed: boolean
  left: string[]
  right: string[]
  /** 1-based start line on each side (the line where this block begins). */
  leftStart: number
  rightStart: number
}

type Op = { t: 'eq' | 'del' | 'add'; s: string }

/** Classic LCS-based line diff. Returns an op sequence (del = left-only, add = right-only). */
function lcsDiff(a: string[], b: string[]): Op[] {
  const n = a.length
  const m = b.length
  // dp[i][j] = LCS length of a[i:] and b[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: 'eq', s: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ t: 'del', s: a[i] })
      i++
    } else {
      ops.push({ t: 'add', s: b[j] })
      j++
    }
  }
  while (i < n) ops.push({ t: 'del', s: a[i++] })
  while (j < m) ops.push({ t: 'add', s: b[j++] })
  return ops
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

export interface MatchingBlock {
  aStart: number
  bStart: number
  len: number
}

/** Maximal runs of equal lines between a and b (from the LCS), in order. */
export function matchingBlocks(a: string[], b: string[]): MatchingBlock[] {
  const ops = lcsDiff(a, b)
  const blocks: MatchingBlock[] = []
  let ai = 0
  let bi = 0
  let cur: MatchingBlock | null = null
  for (const op of ops) {
    if (op.t === 'eq') {
      if (!cur) cur = { aStart: ai, bStart: bi, len: 0 }
      cur.len++
      ai++
      bi++
    } else {
      if (cur) {
        blocks.push(cur)
        cur = null
      }
      if (op.t === 'del') ai++
      else bi++
    }
  }
  if (cur) blocks.push(cur)
  return blocks
}

/** Split text into lines for diffing. */
export function toLines(text: string): string[] {
  return text.split('\n')
}

export interface DiffStats {
  added: number
  removed: number
}

/** Count added (right-only) and removed (left-only) lines between two texts. */
export function diffStats(oldText: string, newText: string): DiffStats {
  const ops = lcsDiff(toLines(oldText), toLines(newText))
  let added = 0
  let removed = 0
  for (const op of ops) {
    if (op.t === 'add') added++
    else if (op.t === 'del') removed++
  }
  return { added, removed }
}

export interface UnifiedDiffOptions {
  oldPath?: string
  newPath?: string
  /** Number of unchanged context lines around each change (default 3). */
  context?: number
}

interface DiffEntry {
  type: 'eq' | 'del' | 'add'
  text: string
  a: number // 1-based old line number
  b: number // 1-based new line number
}

/**
 * Produce a standard unified diff (the `--- / +++ / @@` patch format) for two
 * texts. Returns '' when the texts are identical. Pure and reused from the LCS.
 */
export function toUnifiedDiff(oldText: string, newText: string, options: UnifiedDiffOptions = {}): string {
  const context = options.context ?? 3
  const oldPath = options.oldPath ?? 'a'
  const newPath = options.newPath ?? 'b'
  const ops = lcsDiff(toLines(oldText), toLines(newText))

  // Annotate each op with old/new line numbers.
  const entries: DiffEntry[] = []
  let a = 0
  let b = 0
  for (const op of ops) {
    if (op.t === 'eq') {
      a++
      b++
      entries.push({ type: 'eq', text: op.s, a, b })
    } else if (op.t === 'del') {
      a++
      entries.push({ type: 'del', text: op.s, a, b })
    } else {
      b++
      entries.push({ type: 'add', text: op.s, a, b })
    }
  }

  const changeIdx = entries.flatMap((e, i) => (e.type === 'eq' ? [] : [i]))
  if (changeIdx.length === 0) return ''

  // Merge nearby changes (within context) into hunks.
  const hunks: Array<{ start: number; end: number }> = []
  let i = 0
  while (i < changeIdx.length) {
    let start = Math.max(0, changeIdx[i] - context)
    let end = Math.min(entries.length - 1, changeIdx[i] + context)
    let j = i + 1
    while (j < changeIdx.length && changeIdx[j] - context <= end + 1) {
      end = Math.min(entries.length - 1, changeIdx[j] + context)
      j++
    }
    hunks.push({ start, end })
    i = j
  }

  const lines: string[] = [`--- ${oldPath}`, `+++ ${newPath}`]
  for (const { start, end } of hunks) {
    const slice = entries.slice(start, end + 1)
    const oldLines = slice.filter((e) => e.type !== 'add')
    const newLines = slice.filter((e) => e.type !== 'del')
    const oldStart = oldLines.length ? oldLines[0].a : slice[0].a
    const newStart = newLines.length ? newLines[0].b : slice[0].b
    lines.push(`@@ -${oldStart},${oldLines.length} +${newStart},${newLines.length} @@`)
    for (const e of slice) {
      const prefix = e.type === 'eq' ? ' ' : e.type === 'del' ? '-' : '+'
      lines.push(prefix + e.text)
    }
  }
  return lines.join('\n') + '\n'
}

/** Align two texts into a sequence of equal / changed blocks. */
export function computeBlocks(leftText: string, rightText: string): MergeBlock[] {
  const a = toLines(leftText)
  const b = toLines(rightText)
  const ops = lcsDiff(a, b)

  const blocks: MergeBlock[] = []
  let leftLine = 1
  let rightLine = 1
  let k = 0
  while (k < ops.length) {
    if (ops[k].t === 'eq') {
      const lines: string[] = []
      while (k < ops.length && ops[k].t === 'eq') lines.push(ops[k++].s)
      blocks.push({ changed: false, left: lines, right: lines, leftStart: leftLine, rightStart: rightLine })
      leftLine += lines.length
      rightLine += lines.length
    } else {
      const del: string[] = []
      const add: string[] = []
      while (k < ops.length && ops[k].t !== 'eq') {
        if (ops[k].t === 'del') del.push(ops[k].s)
        else add.push(ops[k].s)
        k++
      }
      blocks.push({ changed: true, left: del, right: add, leftStart: leftLine, rightStart: rightLine })
      leftLine += del.length
      rightLine += add.length
    }
  }
  return blocks
}

function serialize(blocks: MergeBlock[], side: Side): string {
  return blocks.flatMap((b) => b[side]).join('\n')
}

/**
 * Copy one block's content from the source side to the other and return the
 * resulting full texts for both sides. direction 'toRight' applies the left
 * version onto the right (and vice-versa).
 */
export function applyBlock(
  blocks: MergeBlock[],
  index: number,
  direction: 'toRight' | 'toLeft'
): { left: string; right: string } {
  const copy = blocks.map((b) => ({ ...b, left: [...b.left], right: [...b.right] }))
  const block = copy[index]
  if (!block) return { left: serialize(copy, 'left'), right: serialize(copy, 'right') }
  if (direction === 'toRight') block.right = [...block.left]
  else block.left = [...block.right]
  block.changed = !arraysEqual(block.left, block.right)
  return { left: serialize(copy, 'left'), right: serialize(copy, 'right') }
}

/** Indices of the changed blocks (used for prev/next navigation). */
export function changedBlockIndices(blocks: MergeBlock[]): number[] {
  return blocks.flatMap((b, i) => (b.changed ? [i] : []))
}

/** Find the changed-block index whose right-side range contains the given (1-based) line. */
export function blockAtRightLine(blocks: MergeBlock[], line: number): number {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.changed && line >= b.rightStart && line < b.rightStart + Math.max(b.right.length, 1)) return i
  }
  return -1
}
