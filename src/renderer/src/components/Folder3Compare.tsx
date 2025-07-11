import React, { useMemo, useState } from 'react'
import type { MergeArgs } from '../../../shared/git'
import { DEFAULT_OPTIONS, type ThreeWayNode, type ThreeWayResult, type ThreeWayStatus } from '../../../shared/types'
import { FolderPicker } from './FolderPicker'

interface Props {
  theme: 'light' | 'dark'
  onClose: () => void
  /** Open a file's 3-way merge in the mergetool view. */
  onOpenMerge: (args: MergeArgs) => void
}

const STATUS_META: Record<ThreeWayStatus, { label: string; cls: string }> = {
  unchanged: { label: 'unchanged', cls: '' },
  modifiedLeft: { label: 'modified (left)', cls: 'st-left-only' },
  modifiedRight: { label: 'modified (right)', cls: 'st-right-only' },
  modifiedBoth: { label: 'modified (both)', cls: 'st-different' },
  addedLeft: { label: 'added (left)', cls: 'st-left-only' },
  addedRight: { label: 'added (right)', cls: 'st-right-only' },
  addedBoth: { label: 'added (both)', cls: 'st-different' },
  deletedLeft: { label: 'deleted (left)', cls: 'st-left-only' },
  deletedRight: { label: 'deleted (right)', cls: 'st-right-only' },
  deletedBoth: { label: 'deleted (both)', cls: '' },
  conflict: { label: '⚠ conflict', cls: 'tw-conflict' }
}

function flattenFiles(root: ThreeWayNode): ThreeWayNode[] {
  const out: ThreeWayNode[] = []
  const visit = (n: ThreeWayNode): void => {
    for (const c of n.children ?? []) {
      if (c.kind === 'file') out.push(c)
      else visit(c)
    }
  }
  visit(root)
  return out
}

/** Three-way (base / left / right) folder comparison, shown as a full overlay. */
export function Folder3Compare({ onClose, onOpenMerge }: Props): React.JSX.Element {
  const [baseRoot, setBaseRoot] = useState('')
  const [leftRoot, setLeftRoot] = useState('')
  const [rightRoot, setRightRoot] = useState('')
  const [result, setResult] = useState<ThreeWayResult | null>(null)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hideUnchanged, setHideUnchanged] = useState(true)

  const run = async (): Promise<void> => {
    if (!baseRoot || !leftRoot || !rightRoot) return
    setComparing(true)
    setError(null)
    try {
      setResult(await window.api.compare3(baseRoot, leftRoot, rightRoot, DEFAULT_OPTIONS))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setComparing(false)
    }
  }

  const files = useMemo(() => (result ? flattenFiles(result.root) : []), [result])
  const rows = hideUnchanged ? files.filter((f) => f.status !== 'unchanged') : files

  const openMerge = (n: ThreeWayNode): void => {
    if (n.base && n.left && n.right) {
      onOpenMerge({ base: n.base.path, local: n.left.path, remote: n.right.path, merged: n.left.path })
    }
  }

  const s = result?.summary

  return (
    <div className="file-compare">
      <div className="toolbar">
        <div className="toolbar-row pickers">
          <FolderPicker label="Base" value={baseRoot} onChange={setBaseRoot} />
          <FolderPicker label="Left" value={leftRoot} onChange={setLeftRoot} />
          <FolderPicker label="Right" value={rightRoot} onChange={setRightRoot} />
        </div>
        <div className="toolbar-row controls">
          <button
            className="primary compare-btn"
            disabled={comparing || !baseRoot || !leftRoot || !rightRoot}
            onClick={() => void run()}
          >
            {comparing ? 'Comparing…' : '▶ Compare 3-way'}
          </button>
          <label className="opt checkbox">
            <input type="checkbox" checked={hideUnchanged} onChange={(e) => setHideUnchanged(e.target.checked)} />
            Hide unchanged
          </label>
          {s && (
            <span className="fc-hint">
              <span className="tw-conflict">{s.conflicts} conflicts</span> · {s.modified} modified · {s.added} added ·{' '}
              {s.deleted} deleted · {s.unchanged} unchanged
            </span>
          )}
          <span className="tb-spacer" />
          <button onClick={onClose} title="Close 3-way compare">
            ✕ Close
          </button>
        </div>
      </div>

      <div className="file-compare-body three-way">
        {error && <div className="fc-message error">Failed: {error}</div>}
        {!error && !result && (
          <div className="empty-state">
            <h2>3-Way Folder Compare</h2>
            <p>Pick a common ancestor (Base) plus the Left and Right variants, then Compare.</p>
            <p className="empty-hint">
              Each file is classified against the base. Double-click a file present on all three sides to resolve it in
              the merge view (writes into the Left folder).
            </p>
          </div>
        )}
        {!error && result && (
          <div className="tw-list">
            {rows.map((n) => {
              const meta = STATUS_META[n.status]
              const mergeable = !!(n.base && n.left && n.right)
              return (
                <div
                  key={n.relPath}
                  className={`tw-row ${meta.cls}`}
                  title={mergeable ? 'Double-click to resolve in the merge view' : undefined}
                  onDoubleClick={() => openMerge(n)}
                >
                  <span className={`tw-badge ${meta.cls}`}>{meta.label}</span>
                  <span className="tw-path">{n.relPath}</span>
                  {n.status === 'conflict' && mergeable && <span className="tw-resolve">resolve →</span>}
                </div>
              )
            })}
            {rows.length === 0 && <div className="fc-message">No differences.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
