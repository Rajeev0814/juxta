import type { CompareOptions, CompareResult, ProgressUpdate, Side, ThreeWayResult } from './types'
import type { PersistedSettings } from './settings'
import type { MergeAction } from './sync'
import type { DiffPair, MergeArgs } from './git'

// Channel names used across the IPC boundary, kept in one place.
export const IPC = {
  selectFolder: 'dialog:selectFolder',
  selectFile: 'dialog:selectFile',
  selectSnapshot: 'dialog:selectSnapshot',
  saveSnapshot: 'snapshot:save',
  compare: 'compare:run',
  compare3: 'compare:run3',
  compareArchives: 'compare:archives',
  readArchiveEntry: 'compare:readArchiveEntry',
  cancelCompare: 'compare:cancel',
  compareProgress: 'compare:progress', // main -> renderer (event)
  readFile: 'fs:readFile',
  readFileRange: 'fs:readFileRange',
  firstDifference: 'fs:firstDifference',
  readImage: 'fs:readImage',
  readPdfText: 'fs:readPdfText',
  readOfficeText: 'fs:readOfficeText',
  writeFile: 'fs:writeFile',
  saveText: 'fs:saveText',
  writeClipboard: 'clipboard:write',
  copyEntry: 'merge:copyEntry',
  deleteEntry: 'merge:deleteEntry',
  setFileTimes: 'fs:setFileTimes',
  showInFolder: 'shell:showInFolder',
  popupPathMenu: 'shell:pathMenu',
  makeMatch: 'merge:makeMatch',
  applyPlan: 'merge:applyPlan',
  setTheme: 'app:setTheme',
  loadSettings: 'settings:load',
  saveSettings: 'settings:save',
  menuAction: 'menu:action', // main -> renderer (event)
  setWatch: 'watch:set',
  watchChanged: 'watch:changed', // main -> renderer (event)
  getLaunchDiff: 'git:launchDiff',
  getLaunchMerge: 'git:launchMerge',
  getGitSetup: 'git:setup',
  openDiff: 'git:openDiff', // main -> renderer (event)
  openMerge: 'git:openMerge' // main -> renderer (event)
} as const

export interface CompareRequest {
  leftRoot: string
  rightRoot: string
  options: CompareOptions
}

export interface CopyRequest {
  /** Absolute source path. */
  srcPath: string
  /** Absolute destination path. */
  destPath: string
}

export interface MakeMatchRequest {
  result: CompareResult
  direction: Side // 'left' => make right match left
  /** Send deleted orphans to the Recycle Bin instead of permanently removing. */
  toTrash: boolean
}

export interface DeleteRequest {
  path: string
  /** Send to the Recycle Bin instead of permanently removing. */
  toTrash: boolean
}

export interface FileContents {
  path: string
  text: string
  /** True when the file looks binary (contains NUL bytes) — diffing is skipped. */
  binary: boolean
  /** True when the file was too large to load into the editor. */
  tooLarge: boolean
  /** Detected text encoding label (e.g. "UTF-8", "UTF-16 LE"). */
  encoding: string
  /** Detected line-ending label (e.g. "LF", "CRLF", "Mixed"). */
  eol: string
}

export interface HexWindow {
  /** Hex dump of the requested window, with addresses at the true file offset. */
  hex: string
  /** Total file size in bytes. */
  size: number
}

export interface DiffOffset {
  /** First differing byte offset, or -1 if identical. */
  offset: number
  leftSize: number
  rightSize: number
}

export interface ArchiveEntryContent {
  text: string
  /** True when the entry looked binary (shown as a hex dump), or was absent. */
  binary: boolean
}

// The API surface exposed to the renderer via contextBridge.
export interface RendererApi {
  selectFolder(): Promise<string | null>
  selectFile(): Promise<string | null>
  /** Pick an existing .juxtasnap snapshot file to use as a comparison side. */
  selectSnapshot(): Promise<string | null>
  /** Capture a folder to a snapshot file; returns the saved path or null if cancelled. */
  saveSnapshot(root: string, options: CompareOptions): Promise<string | null>
  compare(req: CompareRequest): Promise<CompareResult>
  /** 3-way folder compare (base / left / right) with per-file classification. */
  compare3(baseRoot: string, leftRoot: string, rightRoot: string, options: CompareOptions): Promise<ThreeWayResult>
  /** Compare the contents of two archive files (e.g. .zip) as a tree. */
  compareArchives(leftPath: string, rightPath: string): Promise<CompareResult>
  /** Read one entry's content from an archive as text (hex dump when binary). */
  readArchiveEntry(archivePath: string, relPath: string): Promise<ArchiveEntryContent>
  cancelCompare(): Promise<void>
  onProgress(cb: (update: ProgressUpdate) => void): () => void
  readFile(path: string): Promise<FileContents>
  /** Hex dump of a byte window of a (possibly huge) file, plus its total size. */
  readFileRange(path: string, offset: number, length: number): Promise<HexWindow>
  /** Byte offset where two files first differ (-1 if identical), with both sizes. */
  firstDifference(leftPath: string, rightPath: string): Promise<DiffOffset>
  /** Read an image file as a data: URL (or null if too large / unreadable). */
  readImage(path: string): Promise<string | null>
  /** Extract the plain text of a PDF file for text-level comparison. */
  readPdfText(path: string): Promise<string>
  /** Extract the plain text of a .docx/.xlsx file for text-level comparison. */
  readOfficeText(path: string): Promise<string>
  writeFile(path: string, text: string): Promise<void>
  writeClipboard(text: string): Promise<void>
  /** Prompt for a save location and write text; returns the path or null if cancelled. */
  saveText(defaultName: string, content: string): Promise<string | null>
  copyEntry(req: CopyRequest): Promise<void>
  deleteEntry(req: DeleteRequest): Promise<void>
  /** Set a file's modification time (ms since epoch) without copying content. */
  setFileTimes(path: string, mtimeMs: number): Promise<void>
  /** Reveal a path in the OS file manager. */
  showInFolder(path: string): Promise<void>
  /** Pop up a native context menu (Show in Explorer / Copy path) for a path. */
  popupPathMenu(path: string): Promise<void>
  makeMatch(req: MakeMatchRequest): Promise<void>
  applyPlan(actions: MergeAction[], toTrash: boolean): Promise<void>
  setTheme(theme: 'light' | 'dark'): Promise<void>
  /** Resolve the absolute path of a dropped folder (Electron's File.path replacement). */
  getPathForFile(file: File): string
  loadSettings(): Promise<PersistedSettings>
  saveSettings(settings: PersistedSettings): Promise<void>
  onMenuAction(cb: (action: string) => void): () => void
  /** Watch these roots for changes (pass null/[] to stop). */
  setWatch(paths: string[] | null): Promise<void>
  onWatchChanged(cb: () => void): () => void
  /** A `--git-diff` pair this process was launched with (difftool), or null. */
  getLaunchDiff(): Promise<DiffPair | null>
  /** git config commands to register Juxta as the difftool. */
  getGitSetup(): Promise<string>
  /** A diff pair forwarded from a second (difftool) launch. */
  onOpenDiff(cb: (pair: DiffPair) => void): () => void
  /** A `--git-merge` request this process was launched with (mergetool), or null. */
  getLaunchMerge(): Promise<MergeArgs | null>
  onOpenMerge(cb: (args: MergeArgs) => void): () => void
}
