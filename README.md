# Juxta

**Juxta** (from *juxtapose* — to place side by side for comparison) is a desktop file & folder
comparison and merge tool built with **Electron + React + TypeScript**. Compare two folder trees
side-by-side, drill into a synchronized text diff, and merge/sync changes between them.

## Features (MVP)

- **Folder compare** — pick two roots, get a synchronized two-pane tree. Entries are classified and
  color-coded as *identical*, *different*, *left-only* or *right-only*, with a *newer* marker.
- **File compare** — side-by-side diff (Monaco) with intra-line highlighting, synchronized
  scrolling, prev/next-difference navigation (`F6` / `Shift+F6`), and section-level merge
  (copy a block ←/→, save back).
- **Text compare** — two editable panes; paste text into each side and the diff updates live.
- **Merge actions** — copy a file/folder left→right or right→left, delete orphans, and one-click
  **"make folders match"** in either direction.
- **Filters** — include/exclude by glob (`*.log`, `node_modules/`), ignore whitespace, ignore case.
- **Comparison rules** — by content (SHA-1 hash), by size + timestamp, or quick (size only).
- **Responsive on large trees** — filesystem walking and hashing run in a **worker thread**; the
  tree view is virtualized.
- Light/dark theme, drag-and-drop folder selection, status bar with diff counts.

## Architecture

```
src/
  core/        Pure Node comparison engine (no Electron) — unit tested
    filters.ts   glob include/exclude matching
    hash.ts      file hashing + whitespace/case normalization
    walk.ts      recursive directory walker
    compare.ts   merge + classify two trees -> CompareResult
    merge.ts     copy / delete / make-match planning + execution
  main/        Electron main process
    index.ts         window, IPC handlers
    compareService.ts owns the worker thread
    worker/compareWorker.ts  runs the engine off the UI thread
  preload/     contextBridge -> window.api
  renderer/    React UI (Toolbar, TwoPaneTree, FileCompare, StatusBar)
  shared/      types + IPC contract shared across layers
tests/         Vitest unit tests for the engine (filters, hashing, compare, merge)
```

The `core` engine is deliberately free of Electron imports so it can be unit-tested directly and
reused (e.g. for a future CLI).

## Getting started

```bash
npm install      # install dependencies
npm run dev      # launch the app with hot reload (electron-vite)
npm test         # run the engine unit tests (vitest)
npm run build    # production build into out/
npm start        # preview the production build
```

> Requires Node 18+ (developed on Node 24).

## Building a Windows installer

[electron-builder](https://www.electron.build/) packages the app into a Windows
installer and a portable executable (output in `release/`):

```bash
npm run dist:win   # NSIS installer + portable .exe (x64)
npm run dist:dir   # unpacked app folder only (release/win-unpacked/Juxta.exe)
```

Artifacts:

| File | What it is |
| --- | --- |
| `release/Juxta-<version>-x64.exe` | NSIS installer (choose install dir, desktop/start-menu shortcuts) |
| `release/Juxta-<version>-portable.exe` | Single-file portable build — run without installing |
| `release/win-unpacked/Juxta.exe` | Unpacked app folder |

Notes:
- Executable signing is disabled (`win.signAndEditExecutable: false`) so the
  build runs without a code-signing certificate or elevated privileges. To
  ship signed binaries, provide a certificate via `CSC_LINK`/`CSC_KEY_PASSWORD`
  and remove that flag.
- No custom app icon is set yet, so the default Electron icon is used. Add one
  at `build/icon.ico` (256×256+) to brand the installer and window.

## Keyboard shortcuts

| Key        | Action                       |
| ---------- | ---------------------------- |
| `F5`       | Re-run the comparison        |
| `F6`       | Next difference (file view)  |
| `Shift+F6` | Previous difference          |
| `Esc`      | Close file view              |

## Roadmap (phase 2)

3-way merge, binary/hex viewer, image compare, FTP/SFTP & S3 remotes, session save/restore, CLI
invocation, git external diff/merge integration, intra-file section merge.
