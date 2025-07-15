import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { isFtpUrl, needsPasswordPrompt, parseFtpUrl } from '../src/shared/ftp'
import { mirrorRemote, type RemoteEntry, type RemoteFs } from '../src/core/ftpMirror'
import { writeFile } from 'node:fs/promises'

describe('isFtpUrl / parseFtpUrl', () => {
  it('recognizes ftp/ftps URLs', () => {
    expect(isFtpUrl('ftp://host/x')).toBe(true)
    expect(isFtpUrl('ftps://host')).toBe(true)
    expect(isFtpUrl('C:/local/path')).toBe(false)
  })

  it('parses host, port, credentials, path and defaults', () => {
    expect(parseFtpUrl('ftp://user:pass@example.com:2121/pub/data')).toEqual({
      host: 'example.com',
      port: 2121,
      user: 'user',
      password: 'pass',
      secure: false,
      path: '/pub/data'
    })
    const anon = parseFtpUrl('ftp://host')
    expect(anon).toMatchObject({ host: 'host', port: 21, user: 'anonymous', secure: false, path: '/' })
    expect(parseFtpUrl('ftps://host')?.port).toBe(990)
    expect(parseFtpUrl('http://host')).toBeNull()
  })

  it('prompts for a password only when a user is named without one', () => {
    expect(needsPasswordPrompt('ftp://user@host/x')).toBe(true)
    expect(needsPasswordPrompt('ftp://user:pass@host/x')).toBe(false)
    expect(needsPasswordPrompt('ftp://host/x')).toBe(false) // anonymous
    expect(needsPasswordPrompt('C:/local')).toBe(false)
  })
})

describe('mirrorRemote', () => {
  let dir: string
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('recreates the remote tree locally and downloads files', async () => {
    // In-memory remote: /a.txt, /sub/b.txt
    const tree: Record<string, RemoteEntry[]> = {
      '/': [
        { name: 'a.txt', isDir: false },
        { name: 'sub', isDir: true }
      ],
      '/sub': [{ name: 'b.txt', isDir: false }]
    }
    const contents: Record<string, string> = { '/a.txt': 'AAA', '/sub/b.txt': 'BBB' }
    const fakeFs: RemoteFs = {
      list: async (d) => tree[d] ?? [],
      download: async (remote, local) => {
        await writeFile(local, contents[remote] ?? '')
      }
    }

    dir = await mkdtemp(join(tmpdir(), 'juxta-ftp-test-'))
    const count = await mirrorRemote(fakeFs, '/', dir)

    expect(count).toBe(2)
    expect(await readFile(join(dir, 'a.txt'), 'utf8')).toBe('AAA')
    expect(await readFile(join(dir, 'sub', 'b.txt'), 'utf8')).toBe('BBB')
  })
})
