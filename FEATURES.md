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
- 🟦 B2. 3-way merge — ✅ diff3 auto-merge core + mergetool view (conflict nav, save); ⬜ folder 3-way, in-pane resolve buttons
- ✅ B3. Saved sessions + tabs (multiple comparisons of any type, persisted)
- ✅ B4. Moved / renamed detection (match by content hash)
- 🟦 B5. Ignore-lines — ✅ by-regex + ignore-blank-lines (content hashing); ⬜ per-file-type rule sets
- ✅ B6. Encoding & line-ending — detect UTF-8/UTF-16 + EOL, fix UTF-16 decode, convert EOL (LF/CRLF) on save
- ✅ B7. Reports & patch — unified-diff "Copy patch" + "Save .patch" + "Apply patch", HTML + CSV report export
- ✅ B8. Snapshots — capture a folder to a `.juxtasnap` file; compare a live folder (or another snapshot) against it offline
- ✅ B9. Timestamp operations (copy mtime across without copying content)

## C. Specialized comparators
- ✅ C1. Image compare — side-by-side, opacity overlay, swipe, pixel-diff heatmap + diff %
- ✅ C2. Hex / binary viewer (hex dump shown + diffed for binary files)
- ✅ C3. Table compare — CSV/TSV-aware (ignore row order) + key-column-aligned table view (row/cell diff, auto-detected)
- ✅ C4. Structured data — JSON-, YAML- & XML-aware compare + key-aligned structured tree view (added/removed/changed per node, raw-text toggle)
- ⬜ C5. AST / semantic code diff
- ✅ C6. Document text compare — PDF (pdf-parse) + Office docx/xlsx/pptx text-diff (adm-zip + XML, auto-detected)
- ✅ C7. Archive browsing — zip-family + tar/tgz/tar.gz; archive ↔ folder compare; drill into an entry to diff its content (text/hex)

## D. Remote & integration
- ⬜ D1. Remote folders (SFTP/FTP, S3, ...)
- 🟦 D2. Git — ✅ difftool (open `--git-diff` pairs, single-instance, setup helper); ⬜ mergetool (needs 3-way)
- ⬜ D3. CLI invocation + automation API
- ⬜ D4. OS shell integration (context menu)
- ⬜ D5. Plugin system

## E. Performance & robustness
- ✅ E1. Persistent hash cache (path+size+mtime+flags keyed)
- ✅ E2. File-watch / live re-compare (debounced auto-refresh)
- ⬜ E3. Streaming / byte-range compare for huge files

## F. Differentiators
- ✅ F1. Diff insights — +added/−removed line stats (file/text) + per-directory churn heatmap in the folder tree
- ✅ F2. Minimap + overview ruler with diff markers
- 🟦 F3. Comparison profiles — ✅ save/apply named rule+filter profiles (persisted); ⬜ per-project scoping / cloud sync
