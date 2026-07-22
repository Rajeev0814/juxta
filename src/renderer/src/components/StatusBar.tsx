import React from 'react'
import type { CompareResult, DiffStatus, ProgressUpdate } from '../../../shared/types'

interface Props {
  result: CompareResult | null
  progress: ProgressUpdate | null
  comparing: boolean
  hideIdentical: boolean
  onToggleHideIdentical: (v: boolean) => void
  /** Categories currently hidden from the folder tree (different/leftOnly/rightOnly). */
  hiddenStatuses: ReadonlySet<DiffStatus>
  onToggleStatus: (s: DiffStatus) => void
  useTrash: boolean
  onToggleTrash: (v: boolean) => void
}

export function StatusBar({
  result,
  progress,
  comparing,
  hideIdentical,
  onToggleHideIdentical,
  hiddenStatuses,
  onToggleStatus,
  useTrash,
  onToggleTrash
}: Props): React.JSX.Element {
  return (
    <div className="status-bar">
      <label className="sb-toggle">
        <input
          type="checkbox"
          checked={hideIdentical}
          onChange={(e) => onToggleHideIdentical(e.target.checked)}
        />
        Hide identical
      </label>
      <label className="sb-toggle" title="Deletions go to the Recycle Bin instead of being permanent">
        <input type="checkbox" checked={useTrash} onChange={(e) => onToggleTrash(e.target.checked)} />
        Recycle Bin
      </label>

      <div className="sb-spacer" />

      {comparing && progress && (
        <span className="sb-progress">
          {progress.phase}
          {progress.total > 0 ? ` ${progress.processed}/${progress.total}` : ` ${progress.processed}`}
          {progress.currentPath ? ` — ${truncate(progress.currentPath)}` : ''}
        </span>
      )}

      {result && !comparing && (
        <div className="sb-counts">
          <button
            className={`c c-different chip${hiddenStatuses.has('different') ? ' off' : ''}`}
            onClick={() => onToggleStatus('different')}
            title={hiddenStatuses.has('different') ? 'Show different files' : 'Hide different files'}
          >
            ⬤ {result.summary.different} different
          </button>
          <button
            className={`c c-left chip${hiddenStatuses.has('leftOnly') ? ' off' : ''}`}
            onClick={() => onToggleStatus('leftOnly')}
            title={hiddenStatuses.has('leftOnly') ? 'Show left-only files' : 'Hide left-only files'}
          >
            ⬤ {result.summary.leftOnly} left only
          </button>
          <button
            className={`c c-right chip${hiddenStatuses.has('rightOnly') ? ' off' : ''}`}
            onClick={() => onToggleStatus('rightOnly')}
            title={hiddenStatuses.has('rightOnly') ? 'Show right-only files' : 'Hide right-only files'}
          >
            ⬤ {result.summary.rightOnly} right only
          </button>
          {result.summary.moved > 0 && (
            <span className="c c-moved" title="Renamed/moved files (same content, different path)">
              ⇄ {result.summary.moved} moved
            </span>
          )}
          <span className="c c-identical">⬤ {result.summary.identical} identical</span>
          <span className="c c-total">{result.summary.totalFiles} files · {result.elapsedMs} ms</span>
        </div>
      )}
    </div>
  )
}

function truncate(p: string, max = 60): string {
  return p.length > max ? `…${p.slice(p.length - max)}` : p
}
