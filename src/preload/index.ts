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
  compare: (req: CompareRequest): Promise<CompareResult> => ipcRenderer.invoke(IPC.compare, req),
  cancelCompare: () => ipcRenderer.invoke(IPC.cancelCompare),
  onProgress: (cb: (update: ProgressUpdate) => void) => {
    const listener = (_e: unknown, update: ProgressUpdate): void => cb(update)
    ipcRenderer.on(IPC.compareProgress, listener)
    return () => ipcRenderer.removeListener(IPC.compareProgress, listener)
  },
  readFile: (path: string): Promise<FileContents> => ipcRenderer.invoke(IPC.readFile, path),
  writeFile: (path: string, text: string) => ipcRenderer.invoke(IPC.writeFile, path, text),
  writeClipboard: (text: string) => ipcRenderer.invoke(IPC.writeClipboard, text),
  saveText: (defaultName: string, content: string) => ipcRenderer.invoke(IPC.saveText, defaultName, content),
  copyEntry: (req: CopyRequest) => ipcRenderer.invoke(IPC.copyEntry, req),
  deleteEntry: (req: DeleteRequest) => ipcRenderer.invoke(IPC.deleteEntry, req),
  setFileTimes: (path: string, mtimeMs: number) => ipcRenderer.invoke(IPC.setFileTimes, path, mtimeMs),
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
  }
}

contextBridge.exposeInMainWorld('api', api)
