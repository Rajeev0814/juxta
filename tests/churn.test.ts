import { describe, expect, it } from 'vitest'
import { churnByDir } from '../src/shared/churn'
import type { CompareNode, DiffStatus } from '../src/shared/types'

const file = (relPath: string, status: DiffStatus): CompareNode => ({
  name: relPath.split('/').pop()!,
  relPath,
  kind: 'file',
  status
})

const dir = (relPath: string, children: CompareNode[]): CompareNode => ({
  name: relPath.split('/').pop() ?? '',
  relPath,
  kind: 'directory',
  status: 'different',
  children
})

describe('churnByDir', () => {
  it('computes per-directory change ratios and bubbles counts up to the root', () => {
    const root = dir('', [
      dir('dirA', [file('dirA/f1', 'identical'), file('dirA/f2', 'different')]),
      dir('dirB', [file('dirB/f3', 'leftOnly')]),
      file('f4', 'identical')
    ])

    const churn = churnByDir(root)
    expect(churn.get('dirA')).toEqual({ changed: 1, total: 2, ratio: 0.5 })
    expect(churn.get('dirB')).toEqual({ changed: 1, total: 1, ratio: 1 })
    // Root aggregates every descendant file: 2 changed of 4 total.
    expect(churn.get('')).toEqual({ changed: 2, total: 4, ratio: 0.5 })
  })

  it('reports a zero ratio for a directory with no files', () => {
    const root = dir('', [dir('empty', [])])
    expect(churnByDir(root).get('empty')).toEqual({ changed: 0, total: 0, ratio: 0 })
  })
})
