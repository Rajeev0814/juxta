import { Editor } from '@monaco-editor/react'
import type { editor as Mon } from 'monaco-editor'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { MergeArgs } from '../../../shared/git'
import { merge3 } from '../../../shared/merge3'
import { languageForPath } from '../lib/language'
import { juxtaTheme } from '../lib/monacoSetup'

interface Props {
  args: MergeArgs
  theme: 'light' | 'dark'
  onDone: () => void
  registerNav: (nav: { next: () => void; prev: () => void } | null) => void
}

const CONFLICT_RE = /^<{7}/

/**
 * 3-way merge for `git mergetool`. Auto-merges base/local/remote and shows the
 * result (with conflict markers) in an editable editor; Save writes MERGED.
 */
export function MergeView({ args, theme, onDone, registerNav }: Props): React.JSX.Element {
  const [text, setText] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const editorRef = useRef<Mon.IStandaloneCodeEditor | null>(null)
  const navIndex = useRef(0)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const [base, local, remote] = await Promise.all([
          window.api.readFile(args.base),
          window.api.readFile(args.local),
          window.api.readFile(args.remote)
        ])
        if (cancelled) return
        const result = merge3(base.text, local.text, remote.text, {
          localLabel: 'LOCAL (ours)',
          remoteLabel: 'REMOTE (theirs)'
        })
        setText(result.merged)
        setConflicts(result.conflicts)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [args])

  const gotoConflict = useCallback((dir: 1 | -1): void => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return
    const lines: number[] = []
    for (let n = 1; n <= model.getLineCount(); n++) {
      if (CONFLICT_RE.test(model.getLineContent(n))) lines.push(n)
    }
    if (lines.length === 0) return
    navIndex.current = (navIndex.current + dir + lines.length) % lines.length
    const line = lines[navIndex.current]
    editor.revealLineInCenter(line)
    editor.setPosition({ lineNumber: line, column: 1 })
    editor.focus()
  }, [])

  useEffect(() => {
    const nav = { next: () => gotoConflict(1), prev: () => gotoConflict(-1) }
    registerNav(nav)
    return () => registerNav(null)
  }, [gotoConflict, registerNav])

  const save = useCallback(async (): Promise<void> => {
    if (text === null) return
    await window.api.writeFile(args.merged, text)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [text, args.merged])

  return (
    <div className="file-compare">
      <div className="file-compare-bar">
        <span className="fc-name">Merge — {args.merged}</span>
        <span className={conflicts > 0 ? 'fc-dirty' : 'fc-hint'}>
          {conflicts > 0 ? `${conflicts} conflict(s) — resolve the <<<<<<< markers` : 'auto-merged cleanly'}
        </span>
        <div className="fc-actions">
          <button onClick={() => gotoConflict(-1)} disabled={conflicts === 0} title="Previous conflict (Shift+F6)">
            ↑
          </button>
          <button onClick={() => gotoConflict(1)} disabled={conflicts === 0} title="Next conflict (F6)">
            ↓
          </button>
          <span className="fc-sep" />
          <button className={saved ? '' : 'primary'} onClick={() => void save()} disabled={text === null}>
            {saved ? '✓ Saved' : '💾 Save MERGED'}
          </button>
          <button onClick={onDone} title="Close the merge view">
            ✕ Close
          </button>
        </div>
      </div>
      <div className="file-compare-body">
        {error && <div className="fc-message error">Failed to load: {error}</div>}
        {!error && text === null && <div className="fc-message">Merging…</div>}
        {!error && text !== null && (
          <Editor
            value={text}
            onChange={(v) => setText(v ?? '')}
            language={languageForPath(args.merged)}
            theme={juxtaTheme(theme)}
            onMount={(editor) => {
              editorRef.current = editor
            }}
            options={{ automaticLayout: true, minimap: { enabled: true, renderCharacters: false }, fontSize: 12 }}
          />
        )}
      </div>
    </div>
  )
}
