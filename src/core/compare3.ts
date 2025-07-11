import type {
  CompareOptions,
  EntryKind,
  SideInfo,
  ThreeWayNode,
  ThreeWayResult,
  ThreeWayStatus,
  ThreeWaySummary
} from '../shared/types'
import { createWalkMatcher } from './filters'
import { hashFileRaw } from './hash'
import { walkTree, type WalkEntry } from './walk'

/** Classify one file from its base/left/right content hashes (undefined = absent). */
export function threeWayStatus(
  hb: string | undefined,
  hl: string | undefined,
  hr: string | undefined
): ThreeWayStatus {
  const inB = hb !== undefined
  const inL = hl !== undefined
  const inR = hr !== undefined

  if (inB && inL && inR) {
    const lEq = hl === hb
    const rEq = hr === hb
    if (lEq && rEq) return 'unchanged'
    if (rEq) return 'modifiedLeft'
    if (lEq) return 'modifiedRight'
    return hl === hr ? 'modifiedBoth' : 'conflict'
  }
  if (inB && inL && !inR) return hl === hb ? 'deletedRight' : 'conflict'
  if (inB && !inL && inR) return hr === hb ? 'deletedLeft' : 'conflict'
  if (inB && !inL && !inR) return 'deletedBoth'
  if (!inB && inL && inR) return hl === hr ? 'addedBoth' : 'conflict'
  if (!inB && inL) return 'addedLeft'
  return 'addedRight'
}

interface Merged3 {
  relPath: string
  name: string
  kind: EntryKind
  base?: WalkEntry
  left?: WalkEntry
  right?: WalkEntry
}

type Side = 'base' | 'left' | 'right'

export interface Compare3Input {
  baseRoot: string
  leftRoot: string
  rightRoot: string
  options: CompareOptions
}

function parentKey(relPath: string): string {
  const i = relPath.lastIndexOf('/')
  return i < 0 ? '' : relPath.slice(0, i)
}

function toSide(e: WalkEntry): SideInfo {
  return { path: e.path, size: e.size, mtimeMs: e.mtimeMs, hash: e.hash }
}

/**
 * Compare three folder trees (base / left / right) and classify every file's
 * 3-way status. Always content-based (raw SHA-1). Pure aside from the disk walk.
 */
export async function compareFolders3(input: Compare3Input): Promise<ThreeWayResult> {
  const { baseRoot, leftRoot, rightRoot, options } = input
  const matcher = createWalkMatcher(options.filters)
  const [baseE, leftE, rightE] = await Promise.all([
    walkTree(baseRoot, { matcher }),
    walkTree(leftRoot, { matcher }),
    walkTree(rightRoot, { matcher })
  ])

  const merged = new Map<string, Merged3>()
  const childrenOf = new Map<string, string[]>()

  const add = (e: WalkEntry, side: Side): void => {
    let m = merged.get(e.relPath)
    if (!m) {
      m = { relPath: e.relPath, name: e.name, kind: e.kind }
      merged.set(e.relPath, m)
      const pk = parentKey(e.relPath)
      const sib = childrenOf.get(pk)
      if (sib) sib.push(e.relPath)
      else childrenOf.set(pk, [e.relPath])
    }
    m[side] = e
    if (e.kind === 'directory') m.kind = 'directory'
  }
  for (const e of baseE) add(e, 'base')
  for (const e of leftE) add(e, 'left')
  for (const e of rightE) add(e, 'right')

  // Hash every present file side (raw).
  const files: WalkEntry[] = []
  for (const m of merged.values()) {
    if (m.kind !== 'directory') {
      for (const s of [m.base, m.left, m.right]) if (s) files.push(s)
    }
  }
  await Promise.all(
    files.map(async (e) => {
      try {
        e.hash = await hashFileRaw(e.path)
      } catch {
        // unreadable — leave undefined (treated as absent for classification)
      }
    })
  )

  const summary: ThreeWaySummary = {
    unchanged: 0,
    modified: 0,
    added: 0,
    deleted: 0,
    conflicts: 0,
    totalFiles: 0
  }

  const tally = (status: ThreeWayStatus): void => {
    if (status === 'conflict') summary.conflicts++
    else if (status === 'unchanged') summary.unchanged++
    else if (status.startsWith('modified')) summary.modified++
    else if (status.startsWith('added')) summary.added++
    else if (status.startsWith('deleted')) summary.deleted++
  }

  const build = (relPath: string): ThreeWayNode => {
    const m = merged.get(relPath)!
    const node: ThreeWayNode = {
      name: m.name,
      relPath: m.relPath,
      kind: m.kind,
      status: 'unchanged',
      base: m.base ? toSide(m.base) : undefined,
      left: m.left ? toSide(m.left) : undefined,
      right: m.right ? toSide(m.right) : undefined
    }
    if (m.kind === 'directory') {
      const kids = (childrenOf.get(relPath) ?? []).map(build)
      kids.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'directory' ? -1 : 1) : a.name.localeCompare(b.name)))
      node.children = kids
      node.status = kids.some((c) => c.status === 'conflict')
        ? 'conflict'
        : kids.every((c) => c.status === 'unchanged')
          ? 'unchanged'
          : 'modifiedBoth'
      return node
    }
    summary.totalFiles++
    node.status = threeWayStatus(m.base?.hash, m.left?.hash, m.right?.hash)
    tally(node.status)
    return node
  }

  const rootKids = (childrenOf.get('') ?? []).map(build)
  rootKids.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'directory' ? -1 : 1) : a.name.localeCompare(b.name)))
  const root: ThreeWayNode = {
    name: '',
    relPath: '',
    kind: 'directory',
    status: rootKids.some((c) => c.status === 'conflict')
      ? 'conflict'
      : rootKids.every((c) => c.status === 'unchanged')
        ? 'unchanged'
        : 'modifiedBoth',
    children: rootKids
  }

  return { baseRoot, leftRoot, rightRoot, root, summary }
}
