import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import { afterAll, describe, expect, it } from 'vitest'
import { archiveToWalkEntries, isArchivePath, readArchiveEntryData, readZipEntries } from '../src/core/archive'
import { compareEntryLists } from '../src/core/archiveCompare'
import { compareFolders } from '../src/core/compare'
import { rawContentOptions } from '../src/core/snapshot'
import { DEFAULT_OPTIONS } from '../src/shared/types'
import { makeTree } from './helpers'
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

  it('reads a single entry\'s bytes for drill-in (and null when absent)', async () => {
    const zip = new AdmZip()
    zip.addFile('a/b.txt', Buffer.from('drill me', 'utf8'))
    const zipPath = join(dir, 'drill.zip')
    zip.writeZip(zipPath)

    expect(readArchiveEntryData(zipPath, 'a/b.txt')?.toString('utf8')).toBe('drill me')
    expect(readArchiveEntryData(zipPath, 'missing.txt')).toBeNull()
  })
})

describe('archiveToWalkEntries', () => {
  it('synthesizes directory entries for every ancestor and keeps file hashes', () => {
    const entries: ArchiveEntry[] = [
      { relPath: 'a.txt', isDir: false, size: 3, hash: 'h1' },
      { relPath: 'sub/deep/b.txt', isDir: false, size: 4, hash: 'h2' }
    ]
    const walk = archiveToWalkEntries(entries, '/tmp/x.zip')
    const byRel = new Map(walk.map((w) => [w.relPath, w]))
    expect(byRel.get('sub')?.kind).toBe('directory')
    expect(byRel.get('sub/deep')?.kind).toBe('directory')
    expect(byRel.get('sub/deep/b.txt')?.kind).toBe('file')
    expect(byRel.get('sub/deep/b.txt')?.hash).toBe('h2')
    expect(byRel.get('a.txt')?.hash).toBe('h1')
  })
})

describe('compare an archive against a folder', () => {
  let dir: string
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('classifies files across a .zip and a live folder by content', async () => {
    dir = await mkdtemp(join(tmpdir(), 'juxta-af-'))
    const zip = new AdmZip()
    zip.addFile('same.txt', Buffer.from('shared', 'utf8'))
    zip.addFile('changed.txt', Buffer.from('zip version', 'utf8'))
    zip.addFile('only-zip.txt', Buffer.from('z', 'utf8'))
    const zipPath = join(dir, 'bundle.zip')
    zip.writeZip(zipPath)

    const folder = await makeTree({
      'same.txt': 'shared',
      'changed.txt': 'folder version',
      'only-folder.txt': 'f'
    })

    const result = await compareFolders({
      leftRoot: folder,
      rightRoot: zipPath,
      options: rawContentOptions(DEFAULT_OPTIONS),
      rightEntries: archiveToWalkEntries(readZipEntries(zipPath), zipPath)
    })

    expect(result.summary.identical).toBe(1) // same.txt
    expect(result.summary.different).toBe(1) // changed.txt
    expect(result.summary.leftOnly).toBe(1) // only-folder.txt
    expect(result.summary.rightOnly).toBe(1) // only-zip.txt
  })
})
