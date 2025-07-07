import React, { useEffect, useMemo, useState } from 'react'
import { delimiterForPath } from '../../../shared/csv'
import { diffTables, type TableDiffRow } from '../../../shared/table'

interface Props {
  left: string
  right: string
  hideIdentical: boolean
}

function statusClass(status: TableDiffRow['status']): string {
  if (status === 'changed') return 'st-different'
  if (status === 'leftOnly') return 'st-left-only'
  if (status === 'rightOnly') return 'st-right-only'
  return ''
}

/** The values to show for a row, and the left values to reveal on hover. */
function rowValues(row: TableDiffRow): { cells: string[]; prev?: string[] } {
  if (row.status === 'rightOnly') return { cells: row.right ?? [] }
  if (row.status === 'leftOnly') return { cells: row.left ?? [] }
  // identical / changed: show the right (new) side; changed cells reveal the old.
  return { cells: row.right ?? row.left ?? [], prev: row.left }
}

/** Key-aligned table comparison for two CSV/TSV files. */
export function TableCompareView({ left, right, hideIdentical }: Props): React.JSX.Element {
  const [leftText, setLeftText] = useState<string | null>(null)
  const [rightText, setRightText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [keyColumn, setKeyColumn] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLeftText(null)
    setRightText(null)
    setError(null)
    setKeyColumn(0)
    Promise.all([window.api.readFile(left), window.api.readFile(right)])
      .then(([l, r]) => {
        if (cancelled) return
        if (l.binary || r.binary) throw new Error('file looks binary')
        setLeftText(l.text)
        setRightText(r.text)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [left, right])

  const delimiter = delimiterForPath(left)
  const diff = useMemo(() => {
    if (leftText === null || rightText === null) return null
    return diffTables(leftText, rightText, { delimiter, keyColumn })
  }, [leftText, rightText, delimiter, keyColumn])

  if (error) return <div className="fc-message error">Failed to compare tables: {error}</div>
  if (!diff) return <div className="fc-message">Reading tables…</div>

  const cols = Array.from({ length: diff.columns }, (_, i) => i)
  const colName = (c: number): string => diff.header[c] || `#${c + 1}`
  const visibleRows = hideIdentical ? diff.rows.filter((r) => r.status !== 'identical') : diff.rows
  const s = diff.summary

  return (
    <div className="file-compare">
      <div className="file-compare-bar">
        <span className="fc-name">Table Compare</span>
        <label className="opt">
          Key column:
          <select value={keyColumn} onChange={(e) => setKeyColumn(Number(e.target.value))}>
            {cols.map((c) => (
              <option key={c} value={c}>
                {colName(c)}
              </option>
            ))}
          </select>
        </label>
        <span className="fc-hint">
          <span className="add">{s.rightOnly} added</span> · <span className="del">{s.leftOnly} removed</span> ·{' '}
          <span className="chg">{s.changed} changed</span> · {s.identical} identical
        </span>
      </div>

      <div className="file-compare-body table-compare">
        <table className="table-diff">
          <thead>
            <tr>
              <th className="tc-status" />
              {cols.map((c) => (
                <th key={c} className={c === diff.keyColumn ? 'tc-key' : ''} title={c === diff.keyColumn ? 'Key column' : undefined}>
                  {colName(c)}
                  {c === diff.keyColumn ? ' 🔑' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => {
              const { cells, prev } = rowValues(row)
              return (
                <tr key={`${row.key}:${i}`} className={statusClass(row.status)}>
                  <td className="tc-status" title={row.status}>
                    {row.status === 'rightOnly' ? '+' : row.status === 'leftOnly' ? '−' : row.status === 'changed' ? '≠' : ''}
                  </td>
                  {cols.map((c) => {
                    const changed = row.changedCols.includes(c)
                    return (
                      <td
                        key={c}
                        className={changed ? 'tc-cell-changed' : ''}
                        title={changed && prev ? `was: ${prev[c] ?? ''}` : undefined}
                      >
                        {cells[c] ?? ''}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        {visibleRows.length === 0 && <div className="fc-message">No rows to show.</div>}
      </div>
    </div>
  )
}
