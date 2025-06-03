import { mkdtemp, mkdir, writeFile, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export interface TreeSpec {
  [path: string]: string | { content: string; mtime?: number }
}

/** Create a temp directory and populate it from a {relativePath: content} spec. */
export async function makeTree(spec: TreeSpec): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'bccmp-'))
  for (const [rel, value] of Object.entries(spec)) {
    const abs = join(root, rel)
    await mkdir(dirname(abs), { recursive: true })
    const content = typeof value === 'string' ? value : value.content
    await writeFile(abs, content)
    if (typeof value !== 'string' && value.mtime !== undefined) {
      const t = value.mtime / 1000
      await utimes(abs, t, t)
    }
  }
  return root
}

/** Index every file/dir node in a compare tree by its relPath for easy assertions. */
import type { CompareNode } from '../src/shared/types'
export function indexNodes(root: CompareNode): Map<string, CompareNode> {
  const map = new Map<string, CompareNode>()
  const visit = (n: CompareNode): void => {
    if (n.relPath) map.set(n.relPath, n)
    n.children?.forEach(visit)
  }
  visit(root)
  return map
}
