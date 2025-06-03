import type { CompareNode } from './types'

/**
 * Relative paths of every changed file (different / left-only / right-only) in
 * visual top-to-bottom tree order. Directories are descended into before a
 * level's own files, matching how the two-pane tree renders rows.
 */
export function listChangedFiles(root: CompareNode): string[] {
  const out: string[] = []
  const visit = (node: CompareNode): void => {
    for (const child of node.children ?? []) {
      if (child.kind === 'file' && child.status !== 'identical') out.push(child.relPath)
      if (child.children) visit(child)
    }
  }
  visit(root)
  return out
}

/** Ancestor directory relPaths of a path, root-first: 'a/b/c.txt' -> ['a', 'a/b']. */
export function ancestorsOf(relPath: string): string[] {
  const parts = relPath.split('/')
  const out: string[] = []
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('/'))
  return out
}
