// Key-aligned table comparison: match rows of two CSV/TSV files by a key column
// (not by position), so inserted/deleted/reordered rows are detected and each
// changed cell is pinpointed. Pure — reused directly by the renderer.
import { parseCsv } from './csv'

export type TableRowStatus = 'identical' | 'changed' | 'leftOnly' | 'rightOnly'

export interface TableDiffRow {
  key: string
  status: TableRowStatus
  left?: string[]
  right?: string[]
  /** Column indices whose values differ (only for 'changed' rows). */
  changedCols: number[]
}

export interface TableDiffSummary {
  identical: number
  changed: number
  leftOnly: number
  rightOnly: number
}

export interface TableDiff {
  header: string[]
  /** Total column count across headers and data. */
  columns: number
  keyColumn: number
  rows: TableDiffRow[]
  summary: TableDiffSummary
}

export interface TableDiffOptions {
  delimiter?: string
  /** Treat the first record of each file as a header (default true). */
  hasHeader?: boolean
  /** Zero-based key column index (default 0). */
  keyColumn?: number
}

function rowsEqual(a: string[], b: string[], columns: number): number[] {
  const changed: number[] = []
  for (let c = 0; c < columns; c++) {
    if ((a[c] ?? '') !== (b[c] ?? '')) changed.push(c)
  }
  return changed
}

/** Group data rows by their key-column value, preserving first-seen order. */
function groupByKey(rows: string[][], keyColumn: number): Map<string, string[][]> {
  const map = new Map<string, string[][]>()
  for (const row of rows) {
    const key = row[keyColumn] ?? ''
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }
  return map
}

/**
 * Diff two delimited tables aligned by a key column. Rows sharing a key are
 * paired (by order, so duplicate keys still line up); unmatched rows become
 * left-/right-only. Cell-level differences are recorded per changed row.
 */
export function diffTables(leftText: string, rightText: string, options: TableDiffOptions = {}): TableDiff {
  const delimiter = options.delimiter ?? ','
  const hasHeader = options.hasHeader ?? true
  const keyColumn = options.keyColumn ?? 0

  const leftRecords = parseCsv(leftText, delimiter)
  const rightRecords = parseCsv(rightText, delimiter)

  const leftHeader = hasHeader ? leftRecords[0] ?? [] : []
  const rightHeader = hasHeader ? rightRecords[0] ?? [] : []
  const leftData = hasHeader ? leftRecords.slice(1) : leftRecords
  const rightData = hasHeader ? rightRecords.slice(1) : rightRecords

  const columns = Math.max(
    leftHeader.length,
    rightHeader.length,
    ...leftData.map((r) => r.length),
    ...rightData.map((r) => r.length),
    keyColumn + 1
  )
  const header = leftHeader.length >= rightHeader.length ? leftHeader : rightHeader

  const leftByKey = groupByKey(leftData, keyColumn)
  const rightByKey = groupByKey(rightData, keyColumn)

  // Keys in left order, then right-only keys in right order.
  const keyOrder: string[] = []
  const seen = new Set<string>()
  for (const row of leftData) {
    const k = row[keyColumn] ?? ''
    if (!seen.has(k)) {
      seen.add(k)
      keyOrder.push(k)
    }
  }
  for (const row of rightData) {
    const k = row[keyColumn] ?? ''
    if (!seen.has(k)) {
      seen.add(k)
      keyOrder.push(k)
    }
  }

  const rows: TableDiffRow[] = []
  const summary: TableDiffSummary = { identical: 0, changed: 0, leftOnly: 0, rightOnly: 0 }

  for (const key of keyOrder) {
    const ls = leftByKey.get(key) ?? []
    const rs = rightByKey.get(key) ?? []
    const n = Math.max(ls.length, rs.length)
    for (let i = 0; i < n; i++) {
      const left = ls[i]
      const right = rs[i]
      if (left && right) {
        const changedCols = rowsEqual(left, right, columns)
        const status: TableRowStatus = changedCols.length ? 'changed' : 'identical'
        rows.push({ key, status, left, right, changedCols })
        summary[status]++
      } else if (left) {
        rows.push({ key, status: 'leftOnly', left, changedCols: [] })
        summary.leftOnly++
      } else {
        rows.push({ key, status: 'rightOnly', right, changedCols: [] })
        summary.rightOnly++
      }
    }
  }

  return { header, columns, keyColumn, rows, summary }
}
