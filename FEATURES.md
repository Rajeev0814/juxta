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
- ⬜ B1. Folder sync engine (mirror / update / two-way) with dry-run preview
- ⬜ B2. 3-way merge (files + folders) with auto-merge
- ✅ B3. Saved sessions + tabs (multiple comparisons of any type, persisted)
- ⬜ B4. Moved / renamed detection (match by content hash)
- ⬜ B5. Per-file-type rules / ignore comments via regex
- ⬜ B6. Encoding & line-ending detection / conversion
- ⬜ B7. Reports & patch (HTML report, unified-diff export/apply)
- ⬜ B8. Snapshots (capture + compare against)
- ⬜ B9. Timestamp / attribute operations

## C. Specialized comparators
- ⬜ C1. Image compare (side-by-side, overlay, swipe, pixel diff)
- ⬜ C2. Hex / binary viewer
- ⬜ C3. Table compare (CSV/TSV with key-column alignment)
- ⬜ C4. Structured data compare (JSON/YAML/XML aligned by key)
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
- ⬜ E1. Persistent hash cache (path+size+mtime keyed)
- ⬜ E2. File-watch / live re-compare
- ⬜ E3. Streaming / byte-range compare for huge files

## F. Differentiators
- ⬜ F1. Diff insights (added/removed/churn, heatmap)
- ⬜ F2. Minimap / overview ruler with diff markers
- ⬜ F3. Comparison profiles per project + settings sync
