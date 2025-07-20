# Juxta — feature backlog & progress

Each feature follows the cycle: **analyze → implement → unit test → integration test → commit**.
Status: ⬜ todo · 🟦 in progress · ✅ done

## A. Quick wins (build on current code)
- ✅ A1. Move-to-Recycle-Bin deletes (safe delete) + injectable merge executors
- ✅ A2. Session persistence (roots, options, theme, window bounds)
- ✅ A3. Cancel a running comparison
- ✅ A4. `.gitignore`-style ignore-file loading
- ✅ A5. Section-level merge in the file diff (copy block ←/→, save back)
- ✅ A6. Diff-only navigation (next/prev changed file, jump list)
- ✅ A7. Native application menu wired to actions

## B. Beyond Compare parity (core)
- ✅ B1. Folder sync engine (mirror / update / two-way) with dry-run preview
- ✅ B2. 3-way merge — diff3 auto-merge + mergetool view (conflict nav, save, in-pane resolve) + folder-level 3-way compare as a persisted tab (base/left/right columns + classification; open a file to resolve in the merge view)
- ✅ B3. Saved sessions + tabs (multiple comparisons of any type, persisted)
- ✅ B4. Moved / renamed detection (match by content hash)
- ✅ B5. Ignore-lines & rules — by-regex + ignore-blank-lines (content hashing) + per-file-type rule sets (glob → whitespace/case/blank overrides)
- ✅ B6. Encoding & line-ending — detect UTF-8/UTF-16 + EOL, fix UTF-16 decode, convert EOL (LF/CRLF) on save
- ✅ B7. Reports & patch — unified-diff "Copy patch" + "Save .patch" + "Apply patch", HTML + CSV report export
- ✅ B8. Snapshots — capture a folder to a `.juxtasnap` file; compare a live folder (or another snapshot) against it offline
- ✅ B9. Timestamp operations (copy mtime across without copying content)

## C. Specialized comparators
- ✅ C1. Image compare — side-by-side, opacity overlay, swipe, pixel-diff heatmap + diff %
- ✅ C2. Hex / binary viewer (hex dump shown + diffed for binary files)
- ✅ C3. Table compare — CSV/TSV-aware (ignore row order) + key-column-aligned table view (row/cell diff, auto-detected)
- ✅ C4. Structured data — JSON-, YAML- & XML-aware compare + key-aligned structured tree view (added/removed/changed per node, raw-text toggle)
- 🟦 C5. AST / semantic code diff — ✅ JS/TS family (js/mjs/cjs/jsx/ts/mts/cts/tsx) AST-aware compare + aligned AST tree view (text ⇄ AST toggle), via acorn + acorn-typescript/acorn-jsx; ⬜ non-JS languages (Python/… need native parsers)
- ✅ C6. Document text compare — PDF (pdf-parse) + Office docx/xlsx/pptx text-diff (adm-zip + XML, auto-detected)
- ✅ C7. Archive browsing — zip-family + tar/tgz/tar.gz; archive ↔ folder compare; drill into an entry to diff its content (text/hex)

## D. Remote & integration
- 🟦 D1. Remote folders — ✅ FTP/FTPS: put an `ftp://` URL on a Folder Compare side; it mirrors to a temp folder then runs the normal compare (basic-ftp, injectable/tested); ⬜ SFTP, S3, live two-way sync (need engine VFS)
- ✅ D2. Git — difftool + mergetool (`--git-diff` / `--git-merge`, single-instance forwarding, setup helper; mergetool uses trustExitCode=false so git prompts after the async GUI resolve)
- 🟦 D3. CLI — ✅ headless folder compare (`--cli L R [--out .html/.csv] [--method] [--include/--exclude]`), summary to stdout, HTML/CSV report, exit code 0/1/2; ⬜ richer console output on packaged Windows (GUI-subsystem has no attached console)
- ✅ D4. OS shell integration — Explorer right-click "Juxta: Select Left" + "Compare with Selected" for files & folders (installer registers HKCU verbs; two-step launch opens the right compare)
- ⬜ D5. Plugin system

## E. Performance & robustness
- ✅ E1. Persistent hash cache (path+size+mtime+flags keyed)
- ✅ E2. File-watch / live re-compare (debounced auto-refresh)
- ✅ E3. Huge files — byte-range hex viewer (on-demand windows) + streaming first-difference finder for files over the editor limit

## F. Differentiators
- ✅ F1. Diff insights — +added/−removed line stats (file/text) + per-directory churn heatmap in the folder tree
- ✅ F2. Minimap + overview ruler with diff markers
- 🟦 F3. Comparison profiles — ✅ named rule+filter profiles + per-project scoping (pin options to a folder pair, auto-applied); ⬜ cloud sync
