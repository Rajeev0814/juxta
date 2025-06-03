import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compareFolders } from '../src/core/compare'
import { applyMergePlan, copyEntry, deleteEntry, planMakeMatch } from '../src/core/merge'
import { DEFAULT_FILTERS, type CompareOptions } from '../src/shared/types'
import { makeTree } from './helpers'

const options: CompareOptions = {
  method: 'content',
  filters: { ...DEFAULT_FILTERS, excludeGlobs: [] }
}

describe('copyEntry / deleteEntry', () => {
  it('copies a file into a not-yet-existing destination directory', async () => {
    const left = await makeTree({ 'src/a.txt': 'payload' })
    const right = await makeTree({ 'placeholder.txt': '' })
    const dest = join(right, 'src/a.txt')
    await copyEntry(join(left, 'src/a.txt'), dest)
    expect(await readFile(dest, 'utf8')).toBe('payload')
  })

  it('deletes a file', async () => {
    const root = await makeTree({ 'gone.txt': 'bye' })
    const target = join(root, 'gone.txt')
    expect(existsSync(target)).toBe(true)
    await deleteEntry(target)
    expect(existsSync(target)).toBe(false)
  })
})

describe('planMakeMatch', () => {
  it('plans copies for differences/orphans and deletes for destination-only files', async () => {
    const left = await makeTree({
      'same.txt': 'x',
      'diff.txt': 'left',
      'onlyleft.txt': 'L'
    })
    const right = await makeTree({
      'same.txt': 'x',
      'diff.txt': 'right',
      'onlyright.txt': 'R'
    })
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options })

    // direction 'left' => make RIGHT match LEFT
    const plan = planMakeMatch(res.root, 'left', left, right)
    const byRel = new Map(plan.map((a) => [a.relPath, a]))

    expect(byRel.get('diff.txt')!.kind).toBe('copy')
    expect(byRel.get('onlyleft.txt')!.kind).toBe('copy')
    expect(byRel.get('onlyright.txt')!.kind).toBe('delete')
    expect(byRel.has('same.txt')).toBe(false) // identical => no action
  })
})

describe('applyMergePlan executors (safe delete injection)', () => {
  it('routes deletes through the injected remover and copies through the injected copier', async () => {
    const removed: string[] = []
    const copied: Array<[string, string]> = []
    const actions = [
      { kind: 'copy' as const, srcPath: '/l/a.txt', destPath: '/r/a.txt', relPath: 'a.txt' },
      { kind: 'delete' as const, destPath: '/r/old/deep.txt', relPath: 'old/deep.txt' },
      { kind: 'delete' as const, destPath: '/r/old', relPath: 'old' }
    ]
    await applyMergePlan(actions, {
      remove: async (p) => {
        removed.push(p)
      },
      copy: async (s, d) => {
        copied.push([s, d])
      }
    })
    // Deepest delete runs first; the real disk is never touched.
    expect(removed).toEqual(['/r/old/deep.txt', '/r/old'])
    expect(copied).toEqual([['/l/a.txt', '/r/a.txt']])
  })
})

describe('applyMergePlan (make right match left, end to end)', () => {
  it('produces two identical trees', async () => {
    const left = await makeTree({
      'same.txt': 'x',
      'diff.txt': 'left-content',
      'onlyleft/nested.txt': 'deep'
    })
    const right = await makeTree({
      'same.txt': 'x',
      'diff.txt': 'right-content',
      'onlyright.txt': 'remove me'
    })

    const before = await compareFolders({ leftRoot: left, rightRoot: right, options })
    await applyMergePlan(planMakeMatch(before.root, 'left', left, right))

    const after = await compareFolders({ leftRoot: left, rightRoot: right, options })
    expect(after.summary.different).toBe(0)
    expect(after.summary.leftOnly).toBe(0)
    expect(after.summary.rightOnly).toBe(0)
    expect(existsSync(join(right, 'onlyright.txt'))).toBe(false)
    expect(await readFile(join(right, 'diff.txt'), 'utf8')).toBe('left-content')
    expect(await readFile(join(right, 'onlyleft/nested.txt'), 'utf8')).toBe('deep')
  })
})
