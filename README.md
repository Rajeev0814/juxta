# Juxta

**Juxta** (from *juxtapose* — to place side by side) is a desktop file & folder comparison and
merge tool built with **Electron + React + TypeScript** — a Beyond Compare–style clone. Compare
folders, files, images, documents, archives, tables and structured data; merge and sync changes;
and drive it from git, the Explorer context menu, or the command line.

## Download

Grab the latest Windows build from the [Releases page](https://github.com/Rajeev0814/juxta/releases/latest):

- **[Juxta Setup (installer)](https://github.com/Rajeev0814/juxta/releases/latest/download/Juxta-0.1.0-x64.exe)** — installs to Program Files, adds Start Menu/Desktop shortcuts and the Explorer context menu.
- **[Juxta Portable](https://github.com/Rajeev0814/juxta/releases/latest/download/Juxta-0.1.0-portable.exe)** — no installation, just run it.

## Compare modes

Open a tab from the **+** menu (Folder / File / Text / 3-Way Folders):

- **Folder compare** — synchronized two-pane tree, color-coded *identical / different / left-only /
  right-only* with a *newer* marker, moved/renamed detection, and a per-directory **churn heatmap**.
  Merge actions: copy ←/→, delete orphans, one-click **make folders match**, and **sync**
  (mirror / update / two-way) with a dry-run preview.
- **File compare** — the comparator is **auto-detected** from the file types:
  - **images** (png/jpg/gif/webp…) → side-by-side, opacity overlay, swipe, and pixel-diff heatmap
  - **PDF & Office** (pdf/docx/xlsx/pptx) → extracted-text diff
  - **archives** (zip/jar/tar/tgz/tar.gz) → content-tree compare; double-click an entry to diff it
  - **tables** (csv/tsv) → key-column-aligned row/cell compare
  - **structured** (json/yaml/xml) → key-aligned tree; **js/ts** (+jsx/tsx) → text ⇄ **AST** toggle
  - anything else → Monaco text diff (or hex for binary; a windowed hex viewer for huge files)
- **Text compare** — two editable panes; paste and diff live, copy sections across, apply a patch.
- **3-Way Folders** — base / left / right classification (modified/added/deleted/**conflict**);
  double-click a file to resolve it in the 3-way merge view.

## Filters & rules

Glob include/exclude, ignore whitespace / case / blank lines, ignore-lines-by-regex, and
format-aware compare for **JSON / YAML / XML / CSV** and **JS/TS (AST)**. Bind
whitespace/case/blank overrides to file globs with **per-file-type rules**, save named
**profiles**, and **pin** options to a specific folder pair. Comparison rule: content (SHA-1),
size+timestamp, or quick (size only).

## Snapshots, reports & patches

- **Snapshots** — capture a folder to a `.juxtasnap` file and later compare a live folder (or
  another snapshot) against it offline.
- **Reports** — export a folder comparison as **HTML** or **CSV**.
- **Patches** — copy / save a unified diff, or **apply** a `.patch` in the text compare.

## Integrations

- **Git difftool / mergetool** — the menu's *Git setup* copies the `git config` commands. Then:
  `git difftool` opens pairs in Juxta; `git mergetool` opens the 3-way merge (save MERGED, then
  answer git's "was the merge successful?" prompt).
- **Explorer context menu** (installed build) — right-click **"Juxta: Select Left"** on one item,
  then **"Compare with Selected"** on another (files or folders).
- **FTP/FTPS** — put an `ftp://[user@]host/path` URL on a Folder Compare side; Juxta mirrors it to a
  temp folder and compares. You're prompted for the password (not saved).
- **CLI** — headless folder compare:
  ```
  Juxta --cli <left> <right> [--out report.html|.csv] [--method content|sizeAndTime|quick] \
        [--include a,b] [--exclude a,b]
  ```
  Exit code: `0` identical · `1` differences · `2` error. On packaged Windows use `--out` and the
  exit code (a GUI-subsystem exe has no attached console).

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `F5` | Compare / re-compare |
| `F4` / `Shift+F4` | Next / previous changed file |
| `F6` / `Shift+F6` | Next / previous difference (in a diff view) |
| `Esc` | Close the current file diff |
| `Ctrl+T` | Toggle light / dark theme |
| `Ctrl+Shift+H` | Toggle "hide identical" |
| `Ctrl+Shift+S` | Swap left and right |
| `?` | Keyboard-shortcut help |

## Getting started

```bash
npm install      # install dependencies
npm run dev      # launch with hot reload (electron-vite)
npm test         # run the unit tests (vitest)
npm run typecheck
npm run build    # production build into out/
npm start        # preview the production build
```

> Requires Node 18+.

## Building a Windows installer

```bash
npm run dist:win   # NSIS installer + portable .exe (x64) in release/
npm run dist:dir   # unpacked app folder only (release/win-unpacked/Juxta.exe)
```

| File | What it is |
| --- | --- |
| `release/Juxta-<version>-x64.exe` | NSIS installer (shortcuts + Explorer context-menu verbs) |
| `release/Juxta-<version>-portable.exe` | Single-file portable build |
| `release/win-unpacked/Juxta.exe` | Unpacked app folder |

Signing is disabled (`win.signAndEditExecutable: false`) so it builds without a certificate — the
unsigned exe triggers a SmartScreen prompt on first run (*More info → Run anyway*). To ship signed
binaries, provide `CSC_LINK` / `CSC_KEY_PASSWORD` and remove that flag.

## Architecture

Four layers with a strict rule — **`core` and `shared` never import Electron**:

- **`src/core/`** — pure Node comparison engine (walk, hash, filters, encoding, hex, canonicalizers,
  archive/tar/office readers, merge). Unit-tested directly.
- **`src/shared/`** — pure TS shared by all layers incl. the renderer (IPC contract, types, diff/merge
  math, sync/snapshot/table/structured/AST helpers).
- **`src/main/`** — Electron main (window, IPC, single-instance, git/CLI/shell launch); comparison
  runs in a worker thread with a persistent hash cache.
- **`src/preload/`** — `contextBridge` exposing `window.api`.
- **`src/renderer/`** — React UI.

See `CLAUDE.md` for contributor details and `FEATURES.md` for the feature matrix.
