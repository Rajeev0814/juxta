import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

// Recursively mirror a remote directory tree to a local folder, through an
// injected client interface — so the recursion/path-mapping is unit-testable
// with a fake, while the main process supplies a real FTP-backed implementation.

export interface RemoteEntry {
  name: string
  isDir: boolean
}

export interface RemoteFs {
  list(remoteDir: string): Promise<RemoteEntry[]>
  download(remoteFile: string, localFile: string): Promise<void>
}

export type MirrorProgress = (filesDone: number, currentPath: string) => void

function joinRemote(dir: string, name: string): string {
  return dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`
}

/**
 * Mirror `remoteRoot` into `localRoot`, creating directories and downloading
 * files. Returns the number of files downloaded.
 */
export async function mirrorRemote(
  fs: RemoteFs,
  remoteRoot: string,
  localRoot: string,
  onFile?: MirrorProgress
): Promise<number> {
  let count = 0

  async function recurse(remoteDir: string, localDir: string): Promise<void> {
    await mkdir(localDir, { recursive: true })
    for (const entry of await fs.list(remoteDir)) {
      if (entry.name === '.' || entry.name === '..' || !entry.name) continue
      const remote = joinRemote(remoteDir, entry.name)
      const local = join(localDir, entry.name)
      if (entry.isDir) {
        await recurse(remote, local)
      } else {
        await fs.download(remote, local)
        count++
        onFile?.(count, remote)
      }
    }
  }

  await recurse(remoteRoot || '/', localRoot)
  return count
}
