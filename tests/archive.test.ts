import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import { afterAll, describe, expect, it } from 'vitest'
import { isArchivePath, readZipEntries } from '../src/core/archive'
import { compareEntryLists } from '../src/core/archiveCompare'
import type { ArchiveEntry } from '../src/core/archive'

function indexNodes(root: import('../src/shared/types').CompareNode): Map<string, import('../src/shared/types').CompareNode> {
  const m = new Map<string, import('../src/shared/types').CompareNode>()
  const visit = (n: import('../src/shared/types').CompareNode): void => {
    if (n.relPath) m.set(n.relPath, n)
    n.children?.forEach(visit)
  }
  visit(root)
  return m
}

describe('isArchivePath', () => {
  it('recognizes zip-family extensions', () => {
    expect(isArchivePath('x.zip')).toBe(true)
    expect(isArchivePath('lib.jar')).toBe(true)
    expect(isArchivePath('notes.txt')).toBe(false)
  })
})

describe('compareEntryLists', () => {
  const e = (relPath: string, hash: string, isDir = false): ArchiveEntry => ({
    relPath,
    isDir,
    size: hash.length,
    hash
  })

  it('classifies entries by content hash and nests directories', () => {
    const left = [e('a.txt', 'h1'), e('sub/b.txt', 'h2'), e('sub/only-left.txt', 'h5')]
    const right = [e('a.txt', 'h1'), e('sub/b.txt', 'h3'), e('c.txt', 'h4')]
    const { root, summary } = compareEntryLists(left, right)
    const nodes = indexNodes(root)

    expect(nodes.get('a.txt')!.status).toBe('identical')
    expect(nodes.get('sub/b.txt')!.status).toBe('different')
    expect(nodes.get('sub/only-left.txt')!.status).toBe('leftOnly')
    expect(nodes.get('c.txt')!.status).toBe('rightOnly')
    expect(nodes.get('sub')!.kind).toBe('directory')
    expect(nodes.get('sub')!.status).toBe('different')
    expect(summary).toMatchObject({ identical: 1, different: 1, leftOnly: 1, rightOnly: 1, totalFiles: 4 })
  })
})

describe('readZipEntries', () => {
  let dir: string
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('reads files inside a zip with content hashes', async () => {
    dir = await mkdtemp(join(tmpdir(), 'juxta-zip-'))
    const zip = new AdmZip()
    zip.addFile('hello.txt', Buffer.from('hello world', 'utf8'))
    zip.addFile('dir/nested.txt', Buffer.from('nested', 'utf8'))
    const zipPath = join(dir, 'test.zip')
    zip.writeZip(zipPath)

    const entries = readZipEntries(zipPath)
    const files = entries.filter((e) => !e.isDir)
    const hello = files.find((e) => e.relPath === 'hello.txt')!
    expect(hello).toBeDefined()
    expect(hello.size).toBe('hello world'.length)
    expect(hello.hash).toMatch(/^[0-9a-f]{40}$/)
    expect(files.some((e) => e.relPath === 'dir/nested.txt')).toBe(true)
  })
})
