import { join } from 'node:path'
import { mkdtemp, open, readFile, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { Client as FtpClient } from 'basic-ftp'
import { readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, screen, shell } from 'electron'
import { buildMenuTemplate, type MenuActionId } from './menu'
import {
  IPC,
  type CompareRequest,
  type CopyRequest,
  type DeleteRequest,
  type FileContents,
  type MakeMatchRequest
} from '../shared/ipc'
import { applyMergePlan, copyEntry, deleteEntry, planMakeMatch, type MergeAction } from '../core/merge'
import { decodeText, detectEncoding, detectEol, encodingLabel, eolLabel } from '../core/encoding'
import { firstDifference, toHexDump } from '../core/hex'
import { readArchiveEntries, readArchiveEntryData } from '../core/archive'
import { extractOfficeText } from '../core/office'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { compareEntryLists } from '../core/archiveCompare'
import { DEFAULT_OPTIONS, type CompareOptions, type CompareResult } from '../shared/types'
import { SNAPSHOT_EXT } from '../shared/snapshot'
import { DEFAULT_SETTINGS, type PersistedSettings, type WindowBounds } from '../shared/settings'
import { loadSettings, saveSettings } from './settings'
import { CompareService } from './compareService'
import { FolderWatcher } from './watchService'
import { gitDiffToolCommands, gitMergeToolCommands, parseGitDiffArgs, parseGitMergeArgs } from '../shared/git'
import { parseCompareWith, parseSelectLeft } from '../shared/shell'
import type { ShellCompare } from '../shared/ipc'
import { parseCliArgs, formatCliReport, type CliOptions } from '../shared/cli'
import { findConverter, buildConverterInvocation } from '../shared/converters'
import { execFile } from 'node:child_process'
import { compareFolders } from '../core/compare'
import { toCsvReport, toHtmlReport } from '../shared/report'
import { isFtpUrl, parseFtpUrl } from '../shared/ftp'
import { mirrorRemote, type RemoteFs } from '../core/ftpMirror'

const isDev = !app.isPackaged
/** Files above this size are not loaded into the diff editor. */
const MAX_DIFF_FILE_BYTES = 20 * 1024 * 1024
/** Max bytes rendered as a hex dump for binary files. */
const MAX_HEX_BYTES = 256 * 1024

let mainWindow: BrowserWindow | null = null
let settings: PersistedSettings = DEFAULT_SETTINGS
const compareService = new CompareService(() => mainWindow)
const folderWatcher = new FolderWatcher(() => mainWindow?.webContents.send(IPC.watchChanged))
/** Diff pair / merge request this instance was launched with (git tools), if any. */
const launchDiff = parseGitDiffArgs(process.argv)
const launchMerge = parseGitMergeArgs(process.argv)

/** Headless CLI invocation (`--cli <left> <right> …`), or null for a GUI launch. */
const cliMode = parseCliArgs(process.argv)

/**
 * Run a headless folder comparison and exit with a status code (0 = identical,
 * 1 = differences, 2 = error). On Windows a GUI-subsystem exe may not attach to
 * the parent console, so `--out <file>` and the exit code are the reliable
 * outputs; the stdout summary shows when launched from a real terminal / node.
 */
async function runCli(cli: CliOptions): Promise<void> {
  try {
    const options = {
      method: cli.method ?? 'content',
      filters: {
        ...DEFAULT_OPTIONS.filters,
        includeGlobs: cli.include ?? DEFAULT_OPTIONS.filters.includeGlobs,
        excludeGlobs: cli.exclude ?? DEFAULT_OPTIONS.filters.excludeGlobs
      }
    }
    const result = await compareFolders({ leftRoot: cli.left, rightRoot: cli.right, options })
    const s = result.summary
    process.stdout.write(formatCliReport(result, { quiet: cli.quiet, verbose: cli.verbose }) + '\n')
    if (cli.out) {
      const content = /\.csv$/i.test(cli.out) ? toCsvReport(result) : toHtmlReport(result)
      await writeFile(cli.out, content, 'utf8')
      process.stdout.write(`report written: ${cli.out}\n`)
    }
    const differs = s.different + s.leftOnly + s.rightOnly > 0
    app.exit(differs ? 1 : 0)
  } catch (err) {
    process.stderr.write(`juxta: ${err instanceof Error ? err.message : String(err)}\n`)
    app.exit(2)
  }
}

/**
 * Run a user-configured format-converter command and return its stdout as text.
 * Spawned via execFile (no shell) so arguments can't be re-interpreted; the
 * command itself is user-provided, same trust model as a git difftool.
 */
function runConverterCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (err, stdout) => {
        if (err) reject(err)
        else resolve(stdout)
      }
    )
  })
}

/** Where the Explorer "Select Left" verb stashes the pending left-hand path. */
function pendingComparePath(): string {
  return join(app.getPath('userData'), 'compare-pending.txt')
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** Resolve a `--juxta-compare <path>` launch against the remembered left side. */
function shellCompareFrom(argv: string[]): ShellCompare | null {
  const right = parseCompareWith(argv)
  if (!right) return null
  let left = ''
  try {
    left = readFileSync(pendingComparePath(), 'utf8').trim()
  } catch {
    /* nothing selected */
  }
  try {
    unlinkSync(pendingComparePath())
  } catch {
    /* already gone */
  }
  if (!left) return null
  return { kind: isDir(left) && isDir(right) ? 'folders' : 'files', left, right }
}

// "Select Left" just records the path and exits — no window, no instance lock.
const selectLeft = parseSelectLeft(process.argv)
if (selectLeft) {
  try {
    writeFileSync(pendingComparePath(), selectLeft, 'utf8')
  } catch {
    /* best effort */
  }
  app.quit()
}

// A shell "Compare with Selected" this process was launched with.
let launchCompare: ShellCompare | null = selectLeft ? null : shellCompareFrom(process.argv)

// Single-instance: a second launch (e.g. git difftool on the next file, or an
// Explorer "Compare with" verb) reuses this window and opens a new tab.
// CLI mode exits via runCli, and "select left" already quit above; only a real
// GUI launch takes the single-instance lock (a lost lock means another instance
// is running, so forward and quit).
if (!selectLeft && !cliMode) {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
  } else {
    app.on('second-instance', (_e, argv) => {
      const pair = parseGitDiffArgs(argv)
      const merge = parseGitMergeArgs(argv)
      const shell = shellCompareFrom(argv)
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
        if (merge) mainWindow.webContents.send(IPC.openMerge, merge)
        else if (pair) mainWindow.webContents.send(IPC.openDiff, pair)
        else if (shell) mainWindow.webContents.send(IPC.openCompare, shell)
      }
    })
  }
}

/** Clamp saved bounds onto the current display so the window is always visible. */
function resolveBounds(saved: WindowBounds | null): WindowBounds {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
  const width = Math.min(saved?.width ?? 1400, screenW - 20)
  const height = Math.min(saved?.height ?? 900, screenH - 20)
  const x = saved ? Math.max(0, Math.min(saved.x, screenW - width)) : Math.floor((screenW - width) / 2)
  const y = saved ? Math.max(0, Math.min(saved.y, screenH - height)) : Math.floor((screenH - height) / 2)
  return { x, y, width, height }
}

function createWindow(): void {
  const bounds = resolveBounds(settings.windowBounds)
  // App exe icon editing is disabled for signing reasons, so set the window
  // (taskbar) icon explicitly. In dev it lives under build/; when packaged it
  // is copied to resources/ via electron-builder extraResources.
  const iconPath = isDev
    ? join(__dirname, '../../build/icon.png')
    : join(process.resourcesPath, 'icon.png')

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 720,
    minHeight: 520,
    show: false,
    backgroundColor: '#1e1e1e',
    title: 'Juxta',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  // Persist window geometry as it changes so the next launch restores it.
  const persistBounds = (): void => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized()) {
      settings = { ...settings, windowBounds: mainWindow.getBounds() }
      void saveSettings(settings)
    }
  }
  mainWindow.on('close', persistBounds)
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // electron-vite injects the dev server URL in development.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function installMenu(): void {
  const send = (id: MenuActionId): void => mainWindow?.webContents.send(IPC.menuAction, id)
  const template = buildMenuTemplate(send, { isDev, isMac: process.platform === 'darwin' })
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** Delete a path, sending it to the OS Recycle Bin when requested. */
async function removeEntry(targetPath: string, toTrash: boolean): Promise<void> {
  if (toTrash) await shell.trashItem(targetPath)
  else await deleteEntry(targetPath)
}

function registerIpc(): void {
  ipcMain.handle(IPC.selectFolder, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.selectFile, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.selectSnapshot, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'Juxta snapshot', extensions: ['juxtasnap'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    IPC.saveSnapshot,
    async (_e, root: string, options: CompareOptions): Promise<string | null> => {
      const snapshot = await compareService.capture(root, options)
      const base = root.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || 'folder'
      const result = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: `${base}${SNAPSHOT_EXT}`,
        filters: [{ name: 'Juxta snapshot', extensions: ['juxtasnap'] }]
      })
      if (result.canceled || !result.filePath) return null
      await writeFile(result.filePath, JSON.stringify(snapshot), 'utf8')
      return result.filePath
    }
  )

  ipcMain.handle(IPC.compare, async (_e, req: CompareRequest) => {
    return compareService.compare(req.leftRoot, req.rightRoot, req.options)
  })

  ipcMain.handle(
    IPC.compare3,
    async (_e, baseRoot: string, leftRoot: string, rightRoot: string, options: CompareOptions) => {
      return compareService.compare3(baseRoot, leftRoot, rightRoot, options)
    }
  )

  ipcMain.handle(
    IPC.compareRemote,
    async (_e, leftRoot: string, rightRoot: string, options: CompareOptions, password?: string): Promise<CompareResult> => {
      const remoteUrl = isFtpUrl(leftRoot) ? leftRoot : isFtpUrl(rightRoot) ? rightRoot : null
      if (!remoteUrl) return compareService.compare(leftRoot, rightRoot, options)
      const cfg = parseFtpUrl(remoteUrl)
      if (!cfg) throw new Error(`Invalid FTP URL: ${remoteUrl}`)
      // A password entered at connect time (not persisted in the URL) wins.
      if (password) cfg.password = password

      // Mirror the remote tree into a temp folder, then compare it locally.
      const temp = await mkdtemp(join(tmpdir(), 'juxta-ftp-'))
      const client = new FtpClient()
      try {
        await client.access({
          host: cfg.host,
          port: cfg.port,
          user: cfg.user,
          password: cfg.password,
          secure: cfg.secure
        })
        const rfs: RemoteFs = {
          list: async (dir) => (await client.list(dir)).map((f) => ({ name: f.name, isDir: f.isDirectory })),
          download: async (remote, local) => {
            await client.downloadTo(local, remote)
          }
        }
        await mirrorRemote(rfs, cfg.path || '/', temp)
      } finally {
        client.close()
      }

      const remoteIsLeft = remoteUrl === leftRoot
      const result = await compareService.compare(
        remoteIsLeft ? temp : leftRoot,
        remoteIsLeft ? rightRoot : temp,
        options
      )
      // Relabel the mirrored side back to the URL for display.
      if (remoteIsLeft) result.leftRoot = remoteUrl
      else result.rightRoot = remoteUrl
      return result
    }
  )

  ipcMain.handle(IPC.cancelCompare, async () => {
    compareService.cancel()
  })

  ipcMain.handle(IPC.compareArchives, async (_e, leftPath: string, rightPath: string): Promise<CompareResult> => {
    const { root, summary } = compareEntryLists(readArchiveEntries(leftPath), readArchiveEntries(rightPath))
    return { leftRoot: leftPath, rightRoot: rightPath, options: DEFAULT_OPTIONS, root, summary, moves: [], elapsedMs: 0 }
  })

  ipcMain.handle(
    IPC.readArchiveEntry,
    async (_e, archivePath: string, relPath: string): Promise<{ text: string; binary: boolean }> => {
      const buf = readArchiveEntryData(archivePath, relPath)
      if (!buf) return { text: '', binary: true } // absent on this side
      const enc = detectEncoding(buf)
      const binary = enc.encoding === 'utf8' && buf.subarray(0, 8192).includes(0)
      if (binary) return { text: toHexDump(buf, { maxBytes: MAX_HEX_BYTES }), binary: true }
      return { text: decodeText(buf, enc), binary: false }
    }
  )

  ipcMain.handle(IPC.setWatch, async (_e, paths: string[] | null) => {
    if (paths && paths.length) folderWatcher.watch(paths)
    else folderWatcher.close()
  })

  ipcMain.handle(IPC.readFile, async (_e, path: string): Promise<FileContents> => {
    const info = await stat(path)
    if (info.size > MAX_DIFF_FILE_BYTES) {
      return { path, text: '', binary: false, tooLarge: true, encoding: '', eol: '' }
    }
    const buf = await readFile(path)
    const enc = detectEncoding(buf)
    // Only UTF-8 needs the NUL-byte binary check; UTF-16 legitimately has NULs.
    const binary = enc.encoding === 'utf8' && buf.subarray(0, 8192).includes(0)
    if (binary) {
      // Render a hex dump so binary files can still be viewed/compared.
      return {
        path,
        text: toHexDump(buf, { maxBytes: MAX_HEX_BYTES }),
        binary: true,
        tooLarge: false,
        encoding: 'Binary (hex)',
        eol: ''
      }
    }
    const text = decodeText(buf, enc)
    return {
      path,
      text,
      binary: false,
      tooLarge: false,
      encoding: encodingLabel(enc.encoding),
      eol: eolLabel(detectEol(text))
    }
  })

  ipcMain.handle(
    IPC.readFileRange,
    async (_e, path: string, offset: number, length: number): Promise<{ hex: string; size: number }> => {
      const info = await stat(path)
      const start = Math.max(0, Math.min(offset, info.size))
      const len = Math.max(0, Math.min(length, info.size - start))
      const buf = Buffer.alloc(len)
      if (len > 0) {
        const fh = await open(path, 'r')
        try {
          await fh.read(buf, 0, len, start)
        } finally {
          await fh.close()
        }
      }
      return { hex: toHexDump(buf, { startOffset: start }), size: info.size }
    }
  )

  ipcMain.handle(
    IPC.firstDifference,
    async (_e, leftPath: string, rightPath: string): Promise<{ offset: number; leftSize: number; rightSize: number }> => {
      const [ls, rs] = await Promise.all([stat(leftPath), stat(rightPath)])
      const [lh, rh] = await Promise.all([open(leftPath, 'r'), open(rightPath, 'r')])
      try {
        const CHUNK = 1 << 20 // 1 MiB
        const la = Buffer.alloc(CHUNK)
        const rb = Buffer.alloc(CHUNK)
        const common = Math.min(ls.size, rs.size)
        let pos = 0
        while (pos < common) {
          const want = Math.min(CHUNK, common - pos)
          await Promise.all([lh.read(la, 0, want, pos), rh.read(rb, 0, want, pos)])
          const idx = firstDifference(la.subarray(0, want), rb.subarray(0, want))
          if (idx !== -1) return { offset: pos + idx, leftSize: ls.size, rightSize: rs.size }
          pos += want
        }
        // Identical over the common prefix; differ only if sizes differ.
        return { offset: ls.size === rs.size ? -1 : common, leftSize: ls.size, rightSize: rs.size }
      } finally {
        await Promise.all([lh.close(), rh.close()])
      }
    }
  )

  ipcMain.handle(IPC.readImage, async (_e, path: string): Promise<string | null> => {
    try {
      const info = await stat(path)
      if (info.size > MAX_DIFF_FILE_BYTES) return null
      const buf = await readFile(path)
      const ext = path.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? 'png'
      const mime =
        ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'ico' ? 'image/x-icon' : `image/${ext}`
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      return null
    }
  })

  ipcMain.handle(IPC.readPdfText, async (_e, path: string): Promise<string> => {
    const buf = await readFile(path)
    const data = await pdfParse(buf)
    return data.text
  })

  ipcMain.handle(IPC.readOfficeText, async (_e, path: string): Promise<string> => {
    return extractOfficeText(path)
  })

  ipcMain.handle(IPC.runFormatConverter, async (_e, path: string): Promise<string> => {
    const conv = findConverter(settings.converters, path)
    if (!conv) throw new Error('No format converter is configured for this file type')
    const { command, args } = buildConverterInvocation(conv, path)
    return runConverterCommand(command, args)
  })

  ipcMain.handle(IPC.writeFile, async (_e, path: string, text: string) => {
    await writeFile(path, text, 'utf8')
  })

  ipcMain.handle(IPC.writeClipboard, async (_e, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle(IPC.saveText, async (_e, defaultName: string, content: string): Promise<string | null> => {
    const result = await dialog.showSaveDialog(mainWindow!, { defaultPath: defaultName })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, content, 'utf8')
    return result.filePath
  })

  ipcMain.handle(IPC.copyEntry, async (_e, req: CopyRequest) => {
    await copyEntry(req.srcPath, req.destPath)
  })

  ipcMain.handle(IPC.deleteEntry, async (_e, req: DeleteRequest) => {
    await removeEntry(req.path, req.toTrash)
  })

  ipcMain.handle(IPC.setFileTimes, async (_e, path: string, mtimeMs: number) => {
    const t = mtimeMs / 1000
    await utimes(path, t, t)
  })

  ipcMain.handle(IPC.showInFolder, async (_e, path: string) => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle(IPC.popupPathMenu, async (_e, path: string) => {
    const menu = Menu.buildFromTemplate([
      { label: 'Open in default app', click: () => void shell.openPath(path) },
      { label: 'Show in Explorer', click: () => shell.showItemInFolder(path) },
      { label: 'Copy path', click: () => clipboard.writeText(path) }
    ])
    menu.popup({ window: mainWindow ?? undefined })
  })

  ipcMain.handle(IPC.makeMatch, async (_e, req: MakeMatchRequest) => {
    const plan = planMakeMatch(req.result.root, req.direction, req.result.leftRoot, req.result.rightRoot)
    await applyMergePlan(plan, { remove: (p) => removeEntry(p, req.toTrash) })
  })

  ipcMain.handle(IPC.applyPlan, async (_e, actions: MergeAction[], toTrash: boolean) => {
    await applyMergePlan(actions, { remove: (p) => removeEntry(p, toTrash) })
  })

  ipcMain.handle(IPC.setTheme, async (_e, theme: 'light' | 'dark') => {
    nativeTheme.themeSource = theme
  })

  ipcMain.handle(IPC.getLaunchDiff, async () => launchDiff)
  ipcMain.handle(IPC.getLaunchMerge, async () => launchMerge)
  ipcMain.handle(IPC.getLaunchCompare, async () => {
    const c = launchCompare
    launchCompare = null // consume once
    return c
  })
  ipcMain.handle(IPC.getGitSetup, async () => {
    const exe = process.execPath
    return `# Diff tool\n${gitDiffToolCommands(exe)}\n\n# Merge tool\n${gitMergeToolCommands(exe)}`
  })

  ipcMain.handle(IPC.loadSettings, async () => settings)

  ipcMain.handle(IPC.saveSettings, async (_e, incoming: PersistedSettings) => {
    // The renderer owns UI fields; the main process owns window bounds.
    settings = { ...incoming, windowBounds: settings.windowBounds }
    await saveSettings(settings)
  })
}

app.whenReady().then(async () => {
  // Headless CLI: run the comparison and exit; no window, menu or IPC.
  if (cliMode) {
    await runCli(cliMode)
    return
  }

  settings = await loadSettings()
  compareService.cachePath = join(app.getPath('userData'), 'juxta-hashcache.json')
  nativeTheme.themeSource = settings.theme
  registerIpc()
  installMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  compareService.dispose()
  folderWatcher.close()
  if (process.platform !== 'darwin') app.quit()
})
