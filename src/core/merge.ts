import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { MergeAction } from '../shared/sync'

// The pure planners (plan a sync/make-match) live in shared/sync so they can
// run in the renderer for a dry-run preview too. This module is the fs side.
export { planMakeMatch, planSync, joinUnder } from '../shared/sync'
export type { MergeAction, SyncMode, SyncOptions, SyncPlan } from '../shared/sync'

/**
 * Copy a file or directory to the destination path. Parent dirs are created.
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
