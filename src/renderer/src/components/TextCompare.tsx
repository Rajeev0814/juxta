import { DiffEditor, type MonacoDiffEditor } from '@monaco-editor/react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { editor as MonacoEditorNS } from 'monaco-editor'
import { applyBlock, blockAtRightLine, changedBlockIndices, computeBlocks } from '../../../shared/blocks'
import { juxtaTheme } from '../lib/monacoSetup'

interface Props {
  theme: 'light' | 'dark'
  ignoreWhitespace: boolean
  /** Initial pane contents (used once on mount; the component is uncontrolled after). */
  initialLeft: string
  initialRight: string
  /** Called as the user edits so the owning session can persist the text. */
  onChange: (left: string, right: string) => void
  /** Register prev/next-diff handlers so global shortcuts (F6) can drive them. */
  registerNav: (nav: { next: () => void; prev: () => void } | null) => void
}

/** Replace an editor's full text while preserving the undo stack. */
function setEditorText(ed: MonacoEditorNS.ICodeEditor, text: string): void {
  const model = ed.getModel()
  if (!model) return
  ed.executeEdits('merge', [{ range: model.getFullModelRange(), text }])
  ed.pushUndoStop()
}

/**
 * Free-form text comparison: two editable panes side by side. Paste text into
 * each side and the diff updates live. Sections can be copied between sides.
 */
export function TextCompare({
  theme,
  ignoreWhitespace,
  initialLeft,
  initialRight,
  onChange,
  registerNav
}: Props): React.JSX.Element {
  const editorRef = useRef<MonacoDiffEditor | null>(null)
  const diffIndex = useRef(0)
  const [count, setCount] = useState(0)
  // Inline (unified) view also enables wrapping; side-by-side never wraps,
  // because Monaco's diff cannot wrap the left/original pane (only the right),
  // so wrapping side-by-side would be asymmetric.
  const [inline, setInline] = useState(false)

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
    const original = editor.getOriginalEditor()
    const modified = editor.getModifiedEditor()
    // Seed the panes from the session's saved text.
    if (initialLeft) original.getModel()?.setValue(initialLeft)
    if (initialRight) modified.getModel()?.setValue(initialRight)
    const update = (): void => setCount((editor.getLineChanges() ?? []).length)
    editor.onDidUpdateDiff(update)
    // Persist edits back to the owning session.
    const persist = (): void =>
      onChange(original.getModel()?.getValue() ?? '', modified.getModel()?.getValue() ?? '')
    original.onDidChangeModelContent(persist)
    modified.onDidChangeModelContent(persist)
    update()
  }

  // Copy the changed section at the cursor (or the current nav section) across.
  const takeBlock = useCallback((direction: 'toLeft' | 'toRight'): void => {
    const editor = editorRef.current
    if (!editor) return
    const original = editor.getOriginalEditor()
    const modified = editor.getModifiedEditor()
    const lt = original.getModel()?.getValue() ?? ''
    const rt = modified.getModel()?.getValue() ?? ''
    const blocks = computeBlocks(lt, rt)
    const cursorLine = modified.getPosition()?.lineNumber ?? 1
    let idx = blockAtRightLine(blocks, cursorLine)
    if (idx < 0) {
      const changed = changedBlockIndices(blocks)
      idx = changed[Math.min(diffIndex.current, changed.length - 1)] ?? -1
    }
    if (idx < 0) return
    const result = applyBlock(blocks, idx, direction)
    if (direction === 'toRight') setEditorText(modified, result.right)
    else setEditorText(original, result.left)
  }, [])

  const swap = useCallback((): void => {
    const editor = editorRef.current
    if (!editor) return
    const left = editor.getOriginalEditor()
    const right = editor.getModifiedEditor()
    const lv = left.getModel()?.getValue() ?? ''
    const rv = right.getModel()?.getValue() ?? ''
    setEditorText(left, rv)
    setEditorText(right, lv)
  }, [])

  const clear = useCallback((): void => {
    const editor = editorRef.current
    if (!editor) return
    setEditorText(editor.getOriginalEditor(), '')
    setEditorText(editor.getModifiedEditor(), '')
  }, [])

  return (
    <div className="file-compare">
      <div className="file-compare-bar">
        <span className="fc-name">Text Compare</span>
        <span className="fc-hint">Paste or type into each side — the diff updates live</span>
        <div className="fc-actions">
          <span className="fc-count" title="Changed sections">{count}</span>
          <button onClick={() => gotoDiff(-1)} disabled={count === 0} title="Previous difference (Shift+F6)">
            ↑
          </button>
          <button onClick={() => gotoDiff(1)} disabled={count === 0} title="Next difference (F6)">
            ↓
          </button>
          <span className="fc-sep" />
          <button onClick={() => takeBlock('toLeft')} disabled={count === 0} title="Copy this section from right to left">
            ◀ Take right
          </button>
          <button onClick={() => takeBlock('toRight')} disabled={count === 0} title="Copy this section from left to right">
            Take left ▶
          </button>
          <span className="fc-sep" />
          <button onClick={() => setInline((v) => !v)} title="Inline wraps long lines; side-by-side scrolls them">
            {inline ? '⊟ Side-by-side' : '☰ Inline (wrap)'}
          </button>
          <button onClick={swap} title="Swap the two sides">
            ⇄ Swap
          </button>
          <button onClick={clear} title="Clear both sides">
            Clear
          </button>
        </div>
      </div>

      <div className="file-compare-body">
        <DiffEditor
          original=""
          modified=""
          language="plaintext"
          theme={juxtaTheme(theme)}
          onMount={onMount}
          options={{
            readOnly: false,
            originalEditable: true,
            renderSideBySide: !inline,
            ignoreTrimWhitespace: ignoreWhitespace,
            renderOverviewRuler: true,
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
            diffWordWrap: inline ? 'on' : 'off'
          }}
        />
      </div>
    </div>
  )
}
