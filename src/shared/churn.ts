import type { CompareNode } from './types'

export interface Churn {
  /** Non-identical descendant files. */
  changed: number
  /** Total descendant files. */
  total: number
  /** changed / total, in [0, 1]. */
  ratio: number
}

/**
 * Compute per-directory churn (share of descendant files that differ) for every
 * directory in the tree, keyed by relPath. One post-order pass; results bubble
 * up so a parent's counts include all descendants. Pure.
 */
export function churnByDir(root: CompareNode): Map<string, Churn> {
  const map = new Map<string, Churn>()

  function visit(node: CompareNode): Churn {
    let changed = 0
    let total = 0
    for (const child of node.children ?? []) {
      if (child.kind === 'file') {
        total++
        if (child.status !== 'identical') changed++
      } else {
        const c = visit(child)
        changed += c.changed
        total += c.total
      }
    }
    const churn: Churn = { changed, total, ratio: total ? changed / total : 0 }
    map.set(node.relPath, churn)
    return churn
  }

  visit(root)
  return map
}
