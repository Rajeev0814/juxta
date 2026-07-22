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

/** Filters that decide which folder-tree nodes are visible. */
export interface TreeFilterSpec {
  /** Hide files with 'identical' status. */
  hideIdentical: boolean
  /** Hide files whose status is in this set (different / leftOnly / rightOnly). */
  hiddenStatuses?: ReadonlySet<DiffStatus>
  /** Show only files whose name contains this text (case-insensitive). */
  nameFilter?: string
}

function fileVisible(node: CompareNode, f: TreeFilterSpec, q: string): boolean {
  if (f.hideIdentical && node.status === 'identical') return false
  if (f.hiddenStatuses && f.hiddenStatuses.has(node.status)) return false
  if (q && !node.name.toLowerCase().includes(q)) return false
  return true
}

/**
 * relPaths to show under the given filters: every file passing the filter plus
 * all of their ancestor directories. Single-pass, pure. (A directory is shown
 * only if it has at least one visible descendant file.)
 */
export function visibleNodes(root: CompareNode, f: TreeFilterSpec): Set<string> {
  const q = (f.nameFilter ?? '').trim().toLowerCase()
  const visible = new Set<string>()
  const walk = (node: CompareNode): boolean => {
    if (node.kind === 'file') {
      const v = fileVisible(node, f, q)
      if (v) visible.add(node.relPath)
      return v
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

/** Back-compat helper: visible set for a name filter alone. */
export function visibleForNameFilter(root: CompareNode, query: string): Set<string> {
  return query.trim() ? visibleNodes(root, { hideIdentical: false, nameFilter: query }) : new Set()
}

/**
 * Flatten the tree into the visible rows given the expanded set and the active
 * filters (hide-identical, per-category hide, and name filter). Directories
 * with no visible descendant are dropped. A name filter additionally force-opens
 * the surviving directories so matches are always visible.
 */
export function flatten(
  root: CompareNode,
  expanded: Set<string>,
  hideIdentical: boolean,
  nameFilter = '',
  hiddenStatuses?: ReadonlySet<DiffStatus>
): FlatRow[] {
  const rows: FlatRow[] = []
  const nameActive = nameFilter.trim().length > 0
  const filtering = hideIdentical || nameActive || (!!hiddenStatuses && hiddenStatuses.size > 0)
  const visible = filtering ? visibleNodes(root, { hideIdentical, hiddenStatuses, nameFilter }) : null

  const walk = (node: CompareNode, depth: number): void => {
    for (const child of node.children ?? []) {
      if (visible && !visible.has(child.relPath)) continue
      const hasChildren = !!child.children && child.children.length > 0
      // A name filter force-opens dirs so matches show; other filters respect the expanded set.
      const isOpen = nameActive ? true : expanded.has(child.relPath)
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
