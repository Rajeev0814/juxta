import { DiffEditor, type MonacoDiffEditor } from '@monaco-editor/react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { diffStats } from '../../../shared/blocks'
import { juxtaTheme } from '../lib/monacoSetup'

interface Props {
  left: string
  right: string
  theme: 'light' | 'dark'
  /** Bar title, e.g. "PDF Compare" / "Document Compare". */
  title: string
  /** Extract the comparable plain text from a file path (via the main process). */
  extract: (path: string) => Promise<string>
  /** Register prev/next-diff handlers so global shortcuts (F6) can drive them. */
  registerNav: (nav: { next: () => void; prev: () => void } | null) => void
}

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() || p
}

/**
 * Compare two documents by extracting their text (in the main process) and
 * diffing it in a read-only side-by-side editor. Used for PDF and Office files.
 */
export function ExtractedTextCompareView({
  left,
  right,
  theme,
  title,
  extract,
  registerNav
}: Props): React.JSX.Element {
  const [leftText, setLeftText] = useState<string | null>(null)
  const [rightText, setRightText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inline, setInline] = useState(false)
  const editorRef = useRef<MonacoDiffEditor | null>(null)
  const diffIndex = useRef(0)
  const [count, setCount] = useState(0)
  const [stats, setStats] = useState({ added: 0, removed: 0 })

  useEffect(() => {
    let cancelled = false
    setLeftText(null)
    setRightText(null)
    setError(null)
    const run = async (): Promise<void> => {
      try {
        const [lt, rt] = await Promise.all([extract(left), extract(right)])
        if (cancelled) return
        setLeftText(lt)
        setRightText(rt)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [left, right, extract])

  const gotoDiff = useCallback((dir: 1 | -1): void => {
    const editor = editorRef.current
    if (!editor) return
    const changes = editor.getLineChanges() ?? []
    if (changes.length === 0) return
    diffIndex.current = (diffIndex.current + dir + changes.length) % changes.length
    const change = changes[diffIndex.current]
    const line = change.modifiedStartLineNumber || change.originalStartLineNumber || 1
    const modified = editor.getModifiedEditor()
    modified.revealLineInCenter(line)
    modified.setPosition({ lineNumber: line, column: 1 })
    modified.focus()
  }, [])

  useEffect(() => {
    const nav = { next: () => gotoDiff(1), prev: () => gotoDiff(-1) }
    registerNav(nav)
    return () => registerNav(null)
  }, [gotoDiff, registerNav])

  const onMount = (editor: MonacoDiffEditor): void => {
    editorRef.current = editor
    const update = (): void => {
      setCount((editor.getLineChanges() ?? []).length)
      setStats(diffStats(leftText ?? '', rightText ?? ''))
    }
    editor.onDidUpdateDiff(update)
    update()
  }

  const ready = leftText !== null && rightText !== null

  return (
    <div className="file-compare">
      <div className="file-compare-bar">
        <span className="fc-name">{title}</span>
        <span className="fc-hint" title={`${left}  ↔  ${right}`}>
          {baseName(left)} ↔ {baseName(right)} · extracted text
        </span>
        <div className="fc-actions">
          <span className="fc-count" title="Changed sections">{count}</span>
          {(stats.added > 0 || stats.removed > 0) && (
            <span className="fc-stats" title="Lines added / removed">
              <span className="add">+{stats.added}</span> <span className="del">−{stats.removed}</span>
            </span>
          )}
          <button onClick={() => gotoDiff(-1)} disabled={count === 0} title="Previous difference (Shift+F6)">
            ↑
          </button>
          <button onClick={() => gotoDiff(1)} disabled={count === 0} title="Next difference (F6)">
            ↓
          </button>
          <span className="fc-sep" />
          <button onClick={() => setInline((v) => !v)} title="Inline wraps long lines; side-by-side scrolls them">
            {inline ? '⊟ Side-by-side' : '☰ Inline (wrap)'}
          </button>
        </div>
      </div>

      <div className="file-compare-body">
        {error && <div className="fc-message error">Failed to read document: {error}</div>}
        {!error && !ready && <div className="fc-message">Extracting text…</div>}
        {!error && ready && (
          <DiffEditor
            original={leftText}
            modified={rightText}
            language="plaintext"
            theme={juxtaTheme(theme)}
            onMount={onMount}
            options={{
              readOnly: true,
              renderSideBySide: !inline,
              renderOverviewRuler: true,
              automaticLayout: true,
              minimap: { enabled: true, renderCharacters: false },
              scrollBeyondLastLine: false,
              fontSize: 12,
              diffWordWrap: inline ? 'on' : 'off'
            }}
          />
        )}
      </div>
    </div>
  )
}
