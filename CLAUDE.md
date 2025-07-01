# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Juxta** is a desktop file/folder comparison & merge tool (a Beyond Compare–style clone) built with Electron + React + TypeScript, bundled with electron-vite and tested with Vitest.

## Commands

```bash
npm run dev            # launch app with hot reload (electron-vite dev)
npm run build          # production build into out/  (main + preload + renderer)
npm start              # preview the production build
npm run typecheck      # tsc --noEmit -p tsconfig.json  — run before committing
npm test               # full Vitest suite (node environment)
npx vitest run tests/filters.test.ts      # a single test file
npx vitest run -t "make folders match"    # tests matching a name
npm run test:watch                        # watch mode
npm run dist:win       # build + electron-builder → NSIS installer + portable exe in release/
npm run dist:dir       # build + unpacked app dir (faster, for smoke-testing packaging)
```

Primary shell here is **PowerShell**; it has no heredoc, so run multi-line `git commit -m` via the Bash tool. If `npm run dev` fails with `Error: Electron uninstall`, see the fix in the memory index (manually extract the cached Electron zip into `node_modules/electron/dist`).

**Commit convention for this repo: do NOT add a `Co-Authored-By` trailer** (explicit user preference — overrides the default).

## Architecture

Four layers with a strict dependency rule — **`core` and `shared` never import Electron**:

- **`src/core/`** — pure Node comparison engine (walk, hash, filters, ignore, encoding, hex, json/csv canonicalizers, archive reading, merge execution). No Electron; unit-tested directly. Reusable for a future CLI.
- **`src/shared/`** — pure TS shared by *all* layers, including the renderer. Contains the IPC contract (`ipc.ts`), domain `types.ts`, and renderer-safe pure logic: diff/merge block math (`blocks.ts`, `merge3.ts`), sync planning (`sync.ts`), settings/session shapes, and the `isImagePath`/`isPdfPath`/`isArchivePath` type detectors (`image.ts`/`pdf.ts`/`archive.ts`). Renderer components import these directly — keep anything the renderer needs free of `node:` imports.
- **`src/main/`** — Electron main process: `index.ts` (window, all IPC handlers, single-instance lock, git-tool launch), `compareService.ts` (owns the worker), `watchService.ts`, `menu.ts`, `settings.ts`.
- **`src/preload/`** — `contextBridge` exposing `window.api` (typed as `RendererApi`).
- **`src/renderer/`** — React UI. `App.tsx` is the hub (session tabs, mode branching, keyboard shortcuts, live watch); `components/` are the views; `lib/monacoSetup.ts` configures the locally-bundled Monaco.

### IPC contract — the one pattern to know
Adding a main↔renderer call touches **four files, all keyed off `src/shared/ipc.ts`**:
1. Add a channel constant to the `IPC` object.
2. Add the method to the `RendererApi` interface.
3. Implement it in `src/preload/index.ts` (`ipcRenderer.invoke`).
4. Handle it in `src/main/index.ts` (`ipcMain.handle`).
`main → renderer` push events (progress, menu actions, git-tool open) use `webContents.send` + an `on...` subscription in the preload.

### Comparison runs off the UI thread
`CompareService` spawns `src/main/worker/compareWorker.ts`, which runs the `core` engine and loads/saves a **persistent hash cache** (keyed by path+size+mtime+flags; bypassed when content-transforming filters are active). electron-vite emits the worker as a second rollup input with a predictable filename so main can locate it.

### File Compare auto-detects the comparator
When two files are picked in a File Compare tab, `App.tsx` chooses the view **in order: archive → image → PDF → text/hex**, using the `isXPath` detectors from `shared/`. There is no per-type button — the type of the picked files drives it. PDF text is extracted in main via `readPdfText` and diffed read-only.

### Git external diff/merge
The app registers as a git difftool/mergetool. Launching with `--git-diff`/`--git-merge` argv (parsed in `shared/git.ts`) plus a single-instance lock means a second launch forwards its file pair to the already-open window as a new tab.

## Bundling & packaging gotchas

- `electron.vite.config.ts` uses `externalizeDepsPlugin({ exclude: ['picomatch', 'adm-zip'] })`: excluded deps are **bundled** into the output so the packaged app ships only `out/**` + `package.json` (no `node_modules`).
- **`pdf-parse` is the exception**: it stays *external* (a runtime `require`) because its vendored webpack pdf.js cannot be esbuild-bundled. Its runtime subtree is shipped explicitly via `build.files` globs (`node_modules/pdf-parse/**`, `node-ensure`, `debug`, `ms`). Use `pdf-parse@1.1.1` (pure-JS) — **not v2**, which pulls the native `@napi-rs/canvas`.
- The same webpack-bundle issue breaks pdf-parse under Vitest's module runner, so `tests/pdf.test.ts` extracts via a **real Node child process** (`tests/fixtures/extractPdf.cjs`), mirroring the Electron-main runtime.
- Monaco is **bundled locally** (CSP blocks the CDN) via `loader.config({ monaco })` in `monacoSetup.ts`; custom `juxta-dark`/`juxta-light` themes live there too. Monaco's side-by-side diff cannot wrap the left/original pane — wrapping is only offered in inline mode.
- Windows packaging sets `signAndEditExecutable: false` (runs without a cert / admin), and `build/afterPack.js` stamps the exe icon via standalone `rcedit`.

## Feature backlog
`FEATURES.md` tracks progress (✅/🟦/⬜) across the planned feature set — consult it before picking up new work.
