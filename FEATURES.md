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
- ⬜ B2. 3-way merge (files + folders) with auto-merge
- ✅ B3. Saved sessions + tabs (multiple comparisons of any type, persisted)
- ✅ B4. Moved / renamed detection (match by content hash)
- 🟦 B5. Ignore-lines-by-regex (✅ content hashing); ⬜ per-file-type rule sets
- 🟦 B6. Encoding & line-ending — ✅ detect UTF-8/UTF-16 + EOL, fix UTF-16 decode; ⬜ conversion on save
- 🟦 B7. Reports & patch — ✅ unified-diff "Copy patch", ✅ HTML report export; ⬜ apply-patch
- ⬜ B8. Snapshots (capture + compare against)
- ✅ B9. Timestamp operations (copy mtime across without copying content)

## C. Specialized comparators
- ⬜ C1. Image compare (side-by-side, overlay, swipe, pixel diff)
- ✅ C2. Hex / binary viewer (hex dump shown + diffed for binary files)
- 🟦 C3. Table compare — ✅ CSV/TSV-aware (ignore row order); ⬜ key-column-aligned table view
- 🟦 C4. Structured data — ✅ JSON-aware compare (ignore formatting/key order); ⬜ YAML/XML, key-aligned diff view
- ⬜ C5. AST / semantic code diff
- ⬜ C6. Document text compare (PDF / Office)
- ⬜ C7. Archive browsing (zip/tar as virtual folders)

## D. Remote & integration
- ⬜ D1. Remote folders (SFTP/FTP, S3, ...)
- ⬜ D2. Git difftool / mergetool + conflict resolution
- ⬜ D3. CLI invocation + automation API
- ⬜ D4. OS shell integration (context menu)
- ⬜ D5. Plugin system

## E. Performance & robustness
- ✅ E1. Persistent hash cache (path+size+mtime+flags keyed)
- ✅ E2. File-watch / live re-compare (debounced auto-refresh)
- ⬜ E3. Streaming / byte-range compare for huge files

## F. Differentiators
- 🟦 F1. Diff insights — ✅ +added/−removed line stats (file/text); ⬜ folder churn heatmap
- ✅ F2. Minimap + overview ruler with diff markers
- 🟦 F3. Comparison profiles — ✅ save/apply named rule+filter profiles (persisted); ⬜ per-project scoping / cloud sync
