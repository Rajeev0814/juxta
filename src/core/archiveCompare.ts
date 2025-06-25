import type { CompareNode, CompareSummary, DiffStatus, EntryKind, SideInfo } from '../shared/types'
import type { ArchiveEntry } from '../shared/archive'

// Compare two lists of archive entries (content already hashed) into the same
// CompareNode tree the folder view renders. Pure — no fs/archive access here.

interface Merged {
  relPath: string
  name: string
  kind: EntryKind
  left?: ArchiveEntry
  right?: ArchiveEntry
}

function keyOf(p: string, ignoreCase: boolean): string {
  return ignoreCase ? p.toLowerCase() : p
}
function parentKeyOf(relPath: string, ignoreCase: boolean): string {
  const i = relPath.lastIndexOf('/')
  return i < 0 ? '' : keyOf(relPath.slice(0, i), ignoreCase)
}
function baseName(relPath: string): string {
  const i = relPath.lastIndexOf('/')
  return i < 0 ? relPath : relPath.slice(i + 1)
}
function toSide(e: ArchiveEntry): SideInfo {
  return { path: e.relPath, size: e.size, mtimeMs: 0, hash: e.hash }
}

export interface EntryCompareResult {
  root: CompareNode
  summary: CompareSummary
}

export function compareEntryLists(
  left: ArchiveEntry[],
  right: ArchiveEntry[],
  ignoreCase = false
): EntryCompareResult {
  const merged = new Map<string, Merged>()
  const childrenOf = new Map<string, string[]>()

  // Ensure a node exists for a path, creating ancestor directory nodes too.
  const ensurePath = (relPath: string, kind: EntryKind): Merged => {
    const key = keyOf(relPath, ignoreCase)
    let m = merged.get(key)
    if (!m) {
      m = { relPath, name: baseName(relPath), kind }
      merged.set(key, m)
      const pk = parentKeyOf(relPath, ignoreCase)
      const siblings = childrenOf.get(pk)
      if (siblings) siblings.push(key)
      else childrenOf.set(pk, [key])
      // make sure ancestor dirs exist
      if (relPath.includes('/')) ensurePath(relPath.slice(0, relPath.lastIndexOf('/')), 'directory')
    }
    if (kind === 'directory') m.kind = 'directory'
    return m
  }

  const add = (entries: ArchiveEntry[], side: 'left' | 'right'): void => {
    for (const e of entries) {
      const m = ensurePath(e.relPath, e.isDir ? 'directory' : 'file')
      m[side] = e
    }
  }
  add(left, 'left')
  add(right, 'right')

  const summary: CompareSummary = { identical: 0, different: 0, leftOnly: 0, rightOnly: 0, moved: 0, totalFiles: 0 }

  const build = (key: string): CompareNode => {
    const m = merged.get(key)!
    const node: CompareNode = {
      name: m.name,
      relPath: m.relPath,
      kind: m.kind,
      status: 'identical',
      left: m.left ? toSide(m.left) : undefined,
      right: m.right ? toSide(m.right) : undefined
    }
    if (m.kind === 'directory') {
      const children = (childrenOf.get(key) ?? []).map(build)
      children.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'directory' ? -1 : 1) : a.name.localeCompare(b.name)))
      node.children = children
      node.status = m.left && !m.right ? 'leftOnly' : !m.left && m.right ? 'rightOnly' : children.every((c) => c.status === 'identical') ? 'identical' : 'different'
      return node
    }
    summary.totalFiles++
    let status: DiffStatus
    if (m.left && m.right) status = m.left.hash === m.right.hash ? 'identical' : 'different'
    else status = m.left ? 'leftOnly' : 'rightOnly'
    node.status = status
    summary[status]++
    return node
  }

  const rootChildren = (childrenOf.get('') ?? []).map(build)
  rootChildren.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'directory' ? -1 : 1) : a.name.localeCompare(b.name)))
  const root: CompareNode = {
    name: '',
    relPath: '',
    kind: 'directory',
    status: rootChildren.every((c) => c.status === 'identical') ? 'identical' : 'different',
    children: rootChildren
  }
  return { root, summary }
}
