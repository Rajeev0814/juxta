import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { afterAll, describe, expect, it } from 'vitest'
import { readTarEntries, readTarEntryData } from '../src/core/tar'
import { isArchivePath, isTarPath } from '../src/shared/archive'

/** Build a POSIX ustar header block for one entry. */
function tarHeader(name: string, size: number, type = '0'): Buffer {
  const h = Buffer.alloc(512, 0)
  h.write(name, 0, 'utf8')
  h.write('0000644\0', 100)
  h.write('0000000\0', 108)
  h.write('0000000\0', 116)
  h.write(size.toString(8).padStart(11, '0') + ' ', 124)
  h.write('00000000000 ', 136)
  h.write('        ', 148) // checksum placeholder = 8 spaces
  h.write(type, 156)
  h.write('ustar\0', 257)
  h.write('00', 263)
  let sum = 0
  for (let i = 0; i < 512; i++) sum += h[i]
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148)
  return h
}

function buildTar(files: Array<{ name: string; content: string }>): Buffer {
  const parts: Buffer[] = []
  for (const f of files) {
    const content = Buffer.from(f.content, 'utf8')
    parts.push(tarHeader(f.name, content.length))
    parts.push(content)
    const pad = (512 - (content.length % 512)) % 512
    if (pad) parts.push(Buffer.alloc(pad, 0))
  }
  parts.push(Buffer.alloc(1024, 0)) // end-of-archive: two zero blocks
  return Buffer.concat(parts)
}

const sha1 = (s: string): string => createHash('sha1').update(Buffer.from(s, 'utf8')).digest('hex')

describe('isTarPath / isArchivePath', () => {
  it('recognizes tar-family extensions', () => {
    expect(isTarPath('x.tar')).toBe(true)
    expect(isTarPath('x.tgz')).toBe(true)
    expect(isTarPath('x.tar.gz')).toBe(true)
    expect(isTarPath('x.zip')).toBe(false)
    expect(isArchivePath('x.tar.gz')).toBe(true) // tar-family counts as an archive
  })
})

describe('readTarEntries', () => {
  let dir: string
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('reads plain .tar entries with content hashes', async () => {
    dir = await mkdtemp(join(tmpdir(), 'juxta-tar-'))
    const buf = buildTar([
      { name: 'a.txt', content: 'hello' },
      { name: 'sub/b.txt', content: 'nested content' }
    ])
    const path = join(dir, 'bundle.tar')
    await writeFile(path, buf)

    const entries = readTarEntries(path)
    const a = entries.find((e) => e.relPath === 'a.txt')!
    expect(a.size).toBe(5)
    expect(a.hash).toBe(sha1('hello'))
    expect(entries.find((e) => e.relPath === 'sub/b.txt')!.hash).toBe(sha1('nested content'))
  })

  it('transparently gunzips .tgz', async () => {
    const path = join(dir, 'bundle.tgz')
    await writeFile(path, gzipSync(buildTar([{ name: 'only.txt', content: 'z' }])))
    const entries = readTarEntries(path)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ relPath: 'only.txt', hash: sha1('z') })
  })

  it('reads a single entry\'s bytes for drill-in', async () => {
    const path = join(dir, 'drill.tar')
    await writeFile(path, buildTar([{ name: 'x.txt', content: 'tar drill' }, { name: 'y.txt', content: 'other' }]))
    expect(readTarEntryData(path, 'x.txt')?.toString('utf8')).toBe('tar drill')
    expect(readTarEntryData(path, 'nope.txt')).toBeNull()
  })
})
