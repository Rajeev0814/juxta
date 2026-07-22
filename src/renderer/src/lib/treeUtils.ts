import type { CompareNode, DiffStatus } from '../../../shared/types'

export interface FlatRow {
  node: CompareNode
  depth: number
  hasChildren: boolean
  expanded: boolean
}

/** Collect the relPaths of every directory that (transitively) contains a difference. */
export function defaultExpanded(root: CompareNode): Set<string> {
  const set = new Set<string>()
  const visit = (node: CompareNode): boolean => {
    if (node.kind !== 'directory') return node.status !== 'identical'
    let hasDiff = false
    for (const child of node.children ?? []) {
      if (visit(child)) hasDiff = true
    }
    if (hasDiff && node.relPath !== '') set.add(node.relPath)
    return hasDiff || node.status !== 'identical'
  }
  visit(root)
  return set
}

/**
 * relPaths to show for a name filter: every file whose name contains `query`
 * (case-insensitive) plus all of their ancestor directories. Empty query → an
 * empty set (callers treat that as "no filtering"). Single-pass, pure.
 */
export function visibleForNameFilter(root: CompareNode, query: string): Set<string> {
  const q = query.trim().toLowerCase()
  const visible = new Set<string>()
  if (!q) return visible
  const walk = (node: CompareNode): boolean => {
    if (node.kind === 'file') {
      const match = node.name.toLowerCase().includes(q)
      if (match) visible.add(node.relPath)
      return match
    }
    let any = false
    for (const child of node.children ?? []) {
      if (walk(child)) any = true
    }
    if (any && node.relPath !== '') visible.add(node.relPath)
    return any
  }
  walk(root)
  return visible
}

/**
 * Flatten the tree into the visible rows given the expanded set, an optional
 * "hide identical" filter, and an optional name filter. Directories whose
 * entire subtree is identical are dropped when hideIdentical is on. When a
 * name filter is active, only matching files (and their ancestor dirs) show,
 * and those dirs are forced open so matches are visible.
 */
export function flatten(
  root: CompareNode,
  expanded: Set<string>,
  hideIdentical: boolean,
  nameFilter = ''
): FlatRow[] {
  const rows: FlatRow[] = []
  const filtering = nameFilter.trim().length > 0
  const visible = filtering ? visibleForNameFilter(root, nameFilter) : null

  const walk = (node: CompareNode, depth: number): void => {
    for (const child of node.children ?? []) {
      if (hideIdentical && child.status === 'identical') continue
      if (visible && !visible.has(child.relPath)) continue
      const hasChildren = !!child.children && child.children.length > 0
      // While filtering, force directories open so matches are always visible.
      const isOpen = filtering ? true : expanded.has(child.relPath)
      rows.push({ node: child, depth, hasChildren, expanded: isOpen })
      if (hasChildren && isOpen) walk(child, depth + 1)
    }
  }

  walk(root, 0)
  return rows
}

export const STATUS_LABEL: Record<DiffStatus, string> = {
  identical: 'Identical',
  different: 'Different',
  leftOnly: 'Left only',
  rightOnly: 'Right only'
}

export function statusClass(status: DiffStatus): string {
  switch (status) {
    case 'different':
      return 'st-different'
    case 'leftOnly':
      return 'st-left-only'
    case 'rightOnly':
      return 'st-right-only'
    default:
      return 'st-identical'
  }
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let val = bytes / 1024
  let i = 0
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return `${val.toFixed(val < 10 ? 1 : 0)} ${units[i]}`
}

export function formatTime(mtimeMs: number): string {
  const d = new Date(mtimeMs)
  return d.toLocaleString()
}
