import { DiffEditor, type MonacoDiffEditor } from '@monaco-editor/react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CompareNode } from '../../../shared/types'
import { applyBlock, changedBlockIndices, computeBlocks, diffStats, toUnifiedDiff } from '../../../shared/blocks'
import { languageForPath } from '../lib/language'
import { juxtaTheme } from '../lib/monacoSetup'
import { convertEol } from '../../../shared/eol'
import { HugeFileCompareView } from './HugeFileCompareView'

interface Props {
  node: CompareNode
  theme: 'light' | 'dark'
  ignoreWhitespace: boolean
  onClose: () => void
  /** Register prev/next-diff handlers so global shortcuts (F6) can drive them. */
  registerNav: (nav: { next: () => void; prev: () => void } | null) => void
  /** Called after a successful save so callers can refresh a stale folder diff. */
  onSaved?: () => void
}

/** Block merge is disabled above this combined line count (LCS cost guard). */
const MAX_MERGE_LINES = 40000

export function FileCompare({ node, theme, ignoreWhitespace, onClose, registerNav, onSaved }: Props): React.JSX.Element {
  const [leftText, setLeftText] = useState<string | null>(null)
  const [rightText, setRightText] = useState<string | null>(null)
  const [binary, setBinary] = useState(false)
  const [tooLarge, setTooLarge] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leftDirty, setLeftDirty] = useState(false)
  const [rightDirty, setRightDirty] = useState(false)
  const [current, setCurrent] = useState(0) // index into the changed-block list
  // Inline (unified) view also enables wrapping; side-by-side never wraps
  // (Monaco can't wrap the left/original pane, only the right).
  const [inline, setInline] = useState(false)
  const [copied, setCopied] = useState(false)
  const [meta, setMeta] = useState({ encoding: '', leftEol: '', rightEol: '' })
  const [eolChoice, setEolChoice] = useState<'keep' | 'lf' | 'crlf'>('keep')

  const editorRef = useRef<MonacoDiffEditor | null>(null)

  useEffect(() => {
    let cancelled = false
    setLeftText(null)
    setRightText(null)
    setError(null)
    setLeftDirty(false)
    setRightDirty(false)
    setCurrent(0)
    const load = async (): Promise<void> => {
      try {
        const [left, right] = await Promise.all([
          node.left ? window.api.readFile(node.left.path) : Promise.resolve(null),
          node.right ? window.api.readFile(node.right.path) : Promise.resolve(null)
        ])
        if (cancelled) return
        setBinary((left?.binary ?? false) || (right?.binary ?? false))
        setTooLarge((left?.tooLarge ?? false) || (right?.tooLarge ?? false))
        setLeftText(left?.text ?? '')
        setRightText(right?.text ?? '')
        setMeta({
          encoding: left?.encoding || right?.encoding || '',
          leftEol: left?.eol ?? '',
          rightEol: right?.eol ?? ''
        })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [node])

  const blocks = useMemo(
    () => (leftText !== null && rightText !== null ? computeBlocks(leftText, rightText) : []),
    [leftText, rightText]
  )
  const changed = useMemo(() => changedBlockIndices(blocks), [blocks])
  const stats = useMemo(
    () => (leftText !== null && rightText !== null ? diffStats(leftText, rightText) : { added: 0, removed: 0 }),
    [leftText, rightText]
  )
  const mergeEnabled =
    !binary && !tooLarge && leftText !== null && rightText !== null && blocks.length > 0 &&
    (leftText.length + rightText.length) / 40 < MAX_MERGE_LINES

  const reveal = useCallback(
    (changedIdx: number) => {
      const blockIdx = changed[changedIdx]
      if (blockIdx === undefined) return
      const line = blocks[blockIdx].rightStart
      const editor = editorRef.current
      if (editor) {
        const modified = editor.getModifiedEditor()
        modified.revealLineInCenter(line)
        modified.setPosition({ lineNumber: line, column: 1 })
      }
    },
    [blocks, changed]
  )

  const goto = useCallback(
    (dir: 1 | -1) => {
      if (changed.length === 0) return
      setCurrent((c) => {
        const next = (c + dir + changed.length) % changed.length
        reveal(next)
        return next
      })
    },
    [changed, reveal]
  )

  useEffect(() => {
    const nav = { next: () => goto(1), prev: () => goto(-1) }
    registerNav(nav)
    return () => registerNav(null)
  }, [goto, registerNav])

  // Keep the current pointer in range as blocks change after a merge.
  useEffect(() => {
    setCurrent((c) => (changed.length === 0 ? 0 : Math.min(c, changed.length - 1)))
  }, [changed.length])

  const takeBlock = useCallback(
    (direction: 'toLeft' | 'toRight') => {
      if (!mergeEnabled) return
      const blockIdx = changed[current]
      if (blockIdx === undefined) return
      const result = applyBlock(blocks, blockIdx, direction)
      setLeftText(result.left)
      setRightText(result.right)
      if (direction === 'toLeft') setLeftDirty(true)
      else setRightDirty(true)
    },
    [mergeEnabled, changed, current, blocks]
  )

  const save = useCallback(
    async (side: 'left' | 'right') => {
      const path = side === 'left' ? node.left?.path : node.right?.path
      const text = side === 'left' ? leftText : rightText
      if (!path || text === null) return
      const out = eolChoice === 'keep' ? text : convertEol(text, eolChoice)
      await window.api.writeFile(path, out)
      if (side === 'left') setLeftDirty(false)
      else setRightDirty(false)
      onSaved?.()
    },
    [node, leftText, rightText, onSaved, eolChoice]
  )

  const onMount = (editor: MonacoDiffEditor): void => {
    editorRef.current = editor
  }

  const buildPatch = useCallback((): string | null => {
    if (leftText === null || rightText === null) return null
    return (
      toUnifiedDiff(leftText, rightText, {
        oldPath: node.left?.path ?? node.name,
        newPath: node.right?.path ?? node.name
      }) || null
    )
  }, [leftText, rightText, node])

  const copyPatch = useCallback((): void => {
    const patch = buildPatch()
    if (!patch) return
    void window.api.writeClipboard(patch)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [buildPatch])

  const savePatch = useCallback((): void => {
    const patch = buildPatch()
    if (!patch) return
    void window.api.saveText(`${node.name}.patch`, patch)
  }, [buildPatch, node])

  // Files past the editor's size limit fall back to an on-demand hex viewer.
  if (tooLarge && node.left && node.right) {
    return <HugeFileCompareView left={node.left.path} right={node.right.path} />
  }

  const loaded = leftText !== null && rightText !== null
  const language = languageForPath(node.left?.path ?? node.right?.path ?? '')
  const counter = changed.length > 0 ? `${Math.min(current + 1, changed.length)}/${changed.length}` : '0'
  const eolText =
    meta.leftEol && meta.rightEol && meta.leftEol !== meta.rightEol
      ? `L:${meta.leftEol} R:${meta.rightEol}`
      : meta.leftEol || meta.rightEol

  return (
    <div className="file-compare">
      <div className="file-compare-bar">
        <span className="fc-name" title={node.relPath}>
          {node.name}
          {leftDirty && <span className="fc-dirty" title="Left has unsaved changes"> ●L</span>}
          {rightDirty && <span className="fc-dirty" title="Right has unsaved changes"> ●R</span>}
        </span>
        {meta.encoding && (
          <span className="fc-enc" title="Detected encoding · line endings">
            {meta.encoding}
            {eolText ? ` · ${eolText}` : ''}
          </span>
        )}
        <div className="fc-actions">
          <span className="fc-count" title="Changed sections">{counter}</span>
          {(stats.added > 0 || stats.removed > 0) && (
            <span className="fc-stats" title="Lines added / removed">
              <span className="add">+{stats.added}</span> <span className="del">−{stats.removed}</span>
            </span>
          )}
          <button onClick={() => goto(-1)} disabled={changed.length === 0} title="Previous difference (Shift+F6)">
            ↑
          </button>
          <button onClick={() => goto(1)} disabled={changed.length === 0} title="Next difference (F6)">
            ↓
          </button>
          <span className="fc-sep" />
          <button onClick={() => takeBlock('toLeft')} disabled={!mergeEnabled || changed.length === 0} title="Copy this section from right to left">
            ◀ Take right
          </button>
          <button onClick={() => takeBlock('toRight')} disabled={!mergeEnabled || changed.length === 0} title="Copy this section from left to right">
            Take left ▶
          </button>
          <span className="fc-sep" />
          <button className={leftDirty ? 'primary' : ''} onClick={() => save('left')} disabled={!leftDirty} title="Save the left file">
            Save L
          </button>
          <button className={rightDirty ? 'primary' : ''} onClick={() => save('right')} disabled={!rightDirty} title="Save the right file">
            Save R
          </button>
          <select
            className="eol-select"
            value={eolChoice}
            onChange={(e) => setEolChoice(e.target.value as 'keep' | 'lf' | 'crlf')}
            title="Line endings to write on save"
          >
            <option value="keep">EOL: keep</option>
            <option value="lf">EOL: LF</option>
            <option value="crlf">EOL: CRLF</option>
          </select>
          <span className="fc-sep" />
          <button onClick={() => setInline((v) => !v)} title="Inline wraps long lines; side-by-side scrolls them">
            {inline ? '⊟ Side-by-side' : '☰ Inline (wrap)'}
          </button>
          <button onClick={copyPatch} disabled={!loaded || binary || tooLarge} title="Copy a unified diff (patch) to the clipboard">
            {copied ? '✓ Copied' : '⎘ Patch'}
          </button>
          <button onClick={savePatch} disabled={!loaded || binary || tooLarge} title="Save a unified diff (patch) to a .patch file">
            ⤓ Patch
          </button>
          <span className="fc-sep" />
          <button onClick={onClose} title="Back (Esc)">
            ✕ Close
          </button>
        </div>
      </div>

      <div className="file-compare-body">
        {error && <div className="fc-message error">Failed to load: {error}</div>}
        {!error && !loaded && <div className="fc-message">Loading…</div>}
        {!error && loaded && tooLarge && <div className="fc-message">File too large to diff.</div>}
        {!error && loaded && !tooLarge && (
          <DiffEditor
            original={leftText ?? ''}
            modified={rightText ?? ''}
            language={binary ? 'plaintext' : language}
            theme={juxtaTheme(theme)}
            onMount={onMount}
            keepCurrentOriginalModel={false}
            keepCurrentModifiedModel={false}
            options={{
              readOnly: true,
              originalEditable: false,
              renderSideBySide: !inline,
              ignoreTrimWhitespace: ignoreWhitespace,
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
