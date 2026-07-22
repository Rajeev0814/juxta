import { contextBridge, ipcRenderer, webUtils } from 'electron'
import {
  IPC,
  type CompareRequest,
  type CopyRequest,
  type DeleteRequest,
  type FileContents,
  type MakeMatchRequest,
  type RendererApi
} from '../shared/ipc'
import type { CompareResult, ProgressUpdate } from '../shared/types'

const api: RendererApi = {
  selectFolder: () => ipcRenderer.invoke(IPC.selectFolder),
  selectFile: () => ipcRenderer.invoke(IPC.selectFile),
  selectSnapshot: () => ipcRenderer.invoke(IPC.selectSnapshot),
  saveSnapshot: (root, options) => ipcRenderer.invoke(IPC.saveSnapshot, root, options),
  compare: (req: CompareRequest): Promise<CompareResult> => ipcRenderer.invoke(IPC.compare, req),
  compare3: (baseRoot, leftRoot, rightRoot, options) =>
    ipcRenderer.invoke(IPC.compare3, baseRoot, leftRoot, rightRoot, options),
  compareRemote: (leftRoot, rightRoot, options, password) =>
    ipcRenderer.invoke(IPC.compareRemote, leftRoot, rightRoot, options, password),
  compareArchives: (leftPath: string, rightPath: string): Promise<CompareResult> =>
    ipcRenderer.invoke(IPC.compareArchives, leftPath, rightPath),
  readArchiveEntry: (archivePath: string, relPath: string) =>
    ipcRenderer.invoke(IPC.readArchiveEntry, archivePath, relPath),
  cancelCompare: () => ipcRenderer.invoke(IPC.cancelCompare),
  onProgress: (cb: (update: ProgressUpdate) => void) => {
    const listener = (_e: unknown, update: ProgressUpdate): void => cb(update)
    ipcRenderer.on(IPC.compareProgress, listener)
    return () => ipcRenderer.removeListener(IPC.compareProgress, listener)
  },
  readFile: (path: string): Promise<FileContents> => ipcRenderer.invoke(IPC.readFile, path),
  readFileRange: (path: string, offset: number, length: number) =>
    ipcRenderer.invoke(IPC.readFileRange, path, offset, length),
  firstDifference: (leftPath: string, rightPath: string) =>
    ipcRenderer.invoke(IPC.firstDifference, leftPath, rightPath),
  readImage: (path: string): Promise<string | null> => ipcRenderer.invoke(IPC.readImage, path),
  readPdfText: (path: string): Promise<string> => ipcRenderer.invoke(IPC.readPdfText, path),
  readOfficeText: (path: string): Promise<string> => ipcRenderer.invoke(IPC.readOfficeText, path),
  runFormatConverter: (path: string): Promise<string> => ipcRenderer.invoke(IPC.runFormatConverter, path),
  writeFile: (path: string, text: string) => ipcRenderer.invoke(IPC.writeFile, path, text),
  writeClipboard: (text: string) => ipcRenderer.invoke(IPC.writeClipboard, text),
  saveText: (defaultName: string, content: string) => ipcRenderer.invoke(IPC.saveText, defaultName, content),
  copyEntry: (req: CopyRequest) => ipcRenderer.invoke(IPC.copyEntry, req),
  deleteEntry: (req: DeleteRequest) => ipcRenderer.invoke(IPC.deleteEntry, req),
  setFileTimes: (path: string, mtimeMs: number) => ipcRenderer.invoke(IPC.setFileTimes, path, mtimeMs),
  showInFolder: (path: string) => ipcRenderer.invoke(IPC.showInFolder, path),
  popupPathMenu: (path: string) => ipcRenderer.invoke(IPC.popupPathMenu, path),
  makeMatch: (req: MakeMatchRequest) => ipcRenderer.invoke(IPC.makeMatch, req),
  applyPlan: (actions, toTrash) => ipcRenderer.invoke(IPC.applyPlan, actions, toTrash),
  setTheme: (theme: 'light' | 'dark') => ipcRenderer.invoke(IPC.setTheme, theme),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  loadSettings: () => ipcRenderer.invoke(IPC.loadSettings),
  saveSettings: (settings) => ipcRenderer.invoke(IPC.saveSettings, settings),
  onMenuAction: (cb: (action: string) => void) => {
    const listener = (_e: unknown, action: string): void => cb(action)
    ipcRenderer.on(IPC.menuAction, listener)
    return () => ipcRenderer.removeListener(IPC.menuAction, listener)
  },
  setWatch: (paths: string[] | null) => ipcRenderer.invoke(IPC.setWatch, paths),
  onWatchChanged: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.watchChanged, listener)
    return () => ipcRenderer.removeListener(IPC.watchChanged, listener)
  },
  getLaunchDiff: () => ipcRenderer.invoke(IPC.getLaunchDiff),
  getGitSetup: () => ipcRenderer.invoke(IPC.getGitSetup),
  onOpenDiff: (cb: (pair: { left: string; right: string }) => void) => {
    const listener = (_e: unknown, pair: { left: string; right: string }): void => cb(pair)
    ipcRenderer.on(IPC.openDiff, listener)
    return () => ipcRenderer.removeListener(IPC.openDiff, listener)
  },
  getLaunchMerge: () => ipcRenderer.invoke(IPC.getLaunchMerge),
  onOpenMerge: (cb: (args: import('../shared/git').MergeArgs) => void) => {
    const listener = (_e: unknown, args: import('../shared/git').MergeArgs): void => cb(args)
    ipcRenderer.on(IPC.openMerge, listener)
    return () => ipcRenderer.removeListener(IPC.openMerge, listener)
  },
  getLaunchCompare: () => ipcRenderer.invoke(IPC.getLaunchCompare),
  onOpenCompare: (cb: (c: import('../shared/ipc').ShellCompare) => void) => {
    const listener = (_e: unknown, c: import('../shared/ipc').ShellCompare): void => cb(c)
    ipcRenderer.on(IPC.openCompare, listener)
    return () => ipcRenderer.removeListener(IPC.openCompare, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
