import React from 'react'
import type { CompareResult, ProgressUpdate } from '../../../shared/types'

interface Props {
  result: CompareResult | null
  progress: ProgressUpdate | null
  comparing: boolean
  hideIdentical: boolean
  onToggleHideIdentical: (v: boolean) => void
  useTrash: boolean
  onToggleTrash: (v: boolean) => void
}

export function StatusBar({
  result,
  progress,
  comparing,
  hideIdentical,
  onToggleHideIdentical,
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
          <span className="c c-different">⬤ {result.summary.different} different</span>
          <span className="c c-left">⬤ {result.summary.leftOnly} left only</span>
          <span className="c c-right">⬤ {result.summary.rightOnly} right only</span>
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
