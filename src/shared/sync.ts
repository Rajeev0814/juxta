import type { CompareNode, Side } from './types'

export interface MergeAction {
  kind: 'copy' | 'delete'
  /** Absolute source path (for copy). */
  srcPath?: string
  /** Absolute destination path. */
  destPath: string
  /** Path relative to the roots, for ordering/labelling. */
  relPath: string
}

export type SyncMode =
  | 'mirror' // make destination exactly match source (copy diffs/orphans, delete dest-only)
  | 'update' // copy source files that are newer or missing; never delete
  | 'twoWay' // copy each side's newer/only files to the other; report conflicts

export interface SyncOptions {
  mode: SyncMode
  /** Source side for 'mirror' / 'update'. Ignored for 'twoWay'. */
  direction?: Side
}

export interface SyncPlan {
  actions: MergeAction[]
  /** relPaths where two-way sync can't decide (both sides changed, same mtime). */
  conflicts: string[]
}

function other(side: Side): Side {
  return side === 'left' ? 'right' : 'left'
}

function sideInfo(node: CompareNode, side: Side): CompareNode['left'] {
  return side === 'left' ? node.left : node.right
}

/** Join a forward-slash relative path under a root, matching the root's separator. */
export function joinUnder(root: string, relPath: string): string {
  const windows = /\\/.test(root) || /^[a-zA-Z]:/.test(root)
  const sep = windows ? '\\' : '/'
  const rel = windows ? relPath.replace(/\//g, '\\') : relPath
  return root.replace(/[\\/]+$/, '') + sep + rel
}

/**
 * Compute the file operations for a folder synchronization. Pure — no disk
 * access — so it can drive a dry-run preview and be unit-tested. Execute the
 * returned actions with applyMergePlan (core/merge).
 */
export function planSync(
  root: CompareNode,
  leftRoot: string,
  rightRoot: string,
  options: SyncOptions
): SyncPlan {
  const actions: MergeAction[] = []
  const conflicts: string[] = []
  const rootFor = (side: Side): string => (side === 'left' ? leftRoot : rightRoot)

  const copyFrom = (node: CompareNode, from: Side): void => {
    const src = sideInfo(node, from)
    if (!src) return
    actions.push({
      kind: 'copy',
      srcPath: src.path,
      destPath: joinUnder(rootFor(other(from)), node.relPath),
      relPath: node.relPath
    })
  }
  const deleteOn = (node: CompareNode, side: Side): void => {
    const info = sideInfo(node, side)
    if (!info) return
    actions.push({ kind: 'delete', destPath: info.path, relPath: node.relPath })
  }

  const visit = (node: CompareNode): void => {
    if (node.relPath !== '') {
      if (options.mode === 'mirror') {
        const src = options.direction ?? 'left'
        const dst = other(src)
        const onSrc = sideInfo(node, src)
        const onDst = sideInfo(node, dst)
        if (onSrc && node.status !== 'identical') {
          copyFrom(node, src)
          if (node.kind === 'directory' && !onDst) return // recursive copy covers contents
        } else if (!onSrc && onDst) {
          deleteOn(node, dst)
          return
        }
      } else if (options.mode === 'update') {
        const src = options.direction ?? 'left'
        const onSrc = sideInfo(node, src)
        const onDst = sideInfo(node, other(src))
        if (onSrc && !onDst) {
          copyFrom(node, src)
          if (node.kind === 'directory') return
        } else if (onSrc && onDst && node.status === 'different' && node.newer === src) {
          copyFrom(node, src)
        }
        // never deletes
      } else {
        // twoWay
        if (node.status === 'leftOnly') {
          copyFrom(node, 'left')
          if (node.kind === 'directory') return
        } else if (node.status === 'rightOnly') {
          copyFrom(node, 'right')
          if (node.kind === 'directory') return
        } else if (node.status === 'different') {
          if (node.newer === 'left') copyFrom(node, 'left')
          else if (node.newer === 'right') copyFrom(node, 'right')
          else conflicts.push(node.relPath) // same mtime, both differ
        }
      }
    }
    node.children?.forEach(visit)
  }

  visit(root)
  return { actions, conflicts }
}

/**
 * Plan a timestamp-only copy: apply the source side's mtime to the other side.
 * direction 'left' copies the left file's mtime onto the right file. Returns
 * null unless the file exists on both sides.
 */
export function planTimestamp(
  node: CompareNode,
  direction: Side
): { path: string; mtimeMs: number } | null {
  const src = sideInfo(node, direction)
  const dst = sideInfo(node, other(direction))
  if (!src || !dst) return null
  return { path: dst.path, mtimeMs: src.mtimeMs }
}

/** Back-compat: "make the other side match `direction`" == a mirror sync. */
export function planMakeMatch(
  root: CompareNode,
  direction: Side,
  leftRoot: string,
  rightRoot: string
): MergeAction[] {
  return planSync(root, leftRoot, rightRoot, { mode: 'mirror', direction }).actions
}
