import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { CompareNode, Side } from '../shared/types'

/**
 * Copy a file or directory from one side's absolute path to the mirrored
 * location under the destination root. Parent directories are created.
 */
export async function copyEntry(srcPath: string, destPath: string): Promise<void> {
  await mkdir(dirname(destPath), { recursive: true })
  const info = await stat(srcPath)
  await cp(srcPath, destPath, {
    recursive: info.isDirectory(),
    force: true,
    preserveTimestamps: true
  })
}

/** Permanently delete a file or directory. */
export async function deleteEntry(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true })
}

export interface CopyNodePlan {
  srcPath: string
  destPath: string
}

/**
 * Resolve the source/destination absolute paths for copying a node in the
 * given direction. Returns null if the source side has no entry to copy.
 */
export function planCopy(
  node: CompareNode,
  direction: Side, // 'left' means copy left -> right
  leftRoot: string,
  rightRoot: string
): CopyNodePlan | null {
  if (direction === 'left') {
    if (!node.left) return null
    return { srcPath: node.left.path, destPath: join(rightRoot, node.relPath) }
  }
  if (!node.right) return null
  return { srcPath: node.right.path, destPath: join(leftRoot, node.relPath) }
}

export interface MergeAction {
  kind: 'copy' | 'delete'
  srcPath?: string
  destPath: string
  relPath: string
}

/**
 * Compute the set of file operations that would make the two trees identical
 * by copying every difference/orphan in the chosen direction. "left" makes the
 * right tree match the left; orphans on the destination are deleted.
 *
 * This returns a *plan* only — call applyMergePlan to execute it. Keeping plan
 * and execution separate makes the operation previewable and unit-testable.
 */
export function planMakeMatch(
  root: CompareNode,
  direction: Side,
  leftRoot: string,
  rightRoot: string
): MergeAction[] {
  const actions: MergeAction[] = []
  const srcSide = direction === 'left' ? 'left' : 'right'

  function visit(node: CompareNode): void {
    if (node.relPath !== '') {
      const onSrc = srcSide === 'left' ? node.left : node.right
      const onDest = srcSide === 'left' ? node.right : node.left
      const destPath = join(direction === 'left' ? rightRoot : leftRoot, node.relPath)

      if (onSrc && node.status !== 'identical') {
        // exists on source and differs (or is source-only) -> copy over
        actions.push({
          kind: 'copy',
          srcPath: onSrc.path,
          destPath,
          relPath: node.relPath
        })
        // A directory copy is recursive; don't descend further into it.
        if (node.kind === 'directory' && !onDest) return
      } else if (!onSrc && onDest) {
        // orphan on destination -> delete to mirror the source
        actions.push({ kind: 'delete', destPath, relPath: node.relPath })
        return
      }
    }
    node.children?.forEach(visit)
  }

  visit(root)
  return actions
}

/**
 * Pluggable executors for a merge plan. Defaults perform real (permanent)
 * filesystem operations; the Electron layer injects a trash-based remover so
 * deletions go to the Recycle Bin. Keeping these injectable also makes
 * applyMergePlan unit-testable without touching the disk.
 */
export interface MergeExecutors {
  copy?: (srcPath: string, destPath: string) => Promise<void>
  remove?: (targetPath: string) => Promise<void>
}

export async function applyMergePlan(
  actions: MergeAction[],
  executors: MergeExecutors = {}
): Promise<void> {
  const copy = executors.copy ?? copyEntry
  const remove = executors.remove ?? deleteEntry
  // Deletions first (deepest paths first) so we don't fight directory copies.
  const deletes = actions.filter((a) => a.kind === 'delete').sort((a, b) => b.relPath.length - a.relPath.length)
  const copies = actions.filter((a) => a.kind === 'copy')
  for (const a of deletes) await remove(a.destPath)
  for (const a of copies) await copy(a.srcPath!, a.destPath)
}
