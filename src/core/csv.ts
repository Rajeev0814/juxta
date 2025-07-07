// CSV/TSV canonicalization for content comparison (ignore row order / quoting
// noise). The RFC-4180-ish parser now lives in shared/csv.ts so the renderer's
// table view can reuse it; re-exported here for existing importers. Pure.

import { parseCsv } from '../shared/csv'

export { parseCsv } from '../shared/csv'

function quoteField(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function serializeRecord(fields: string[], delimiter: string): string {
  return fields.map((f) => quoteField(f, delimiter)).join(delimiter)
}

export interface CsvCanonOptions {
  delimiter?: string
  /** Treat the first record as a header that stays on top (default true). */
  hasHeader?: boolean
}

/**
 * Canonicalize a CSV/TSV: keep the header first, sort the remaining data rows,
 * and re-serialize with consistent quoting — so files differing only in row
 * order or quoting compare equal. Returns the original text if it has no rows.
 */
export function canonicalizeCsv(text: string, options: CsvCanonOptions = {}): string {
  const delimiter = options.delimiter ?? ','
  const hasHeader = options.hasHeader ?? true
  const records = parseCsv(text, delimiter)
  if (records.length === 0) return text

  const header = hasHeader ? records.slice(0, 1) : []
  const data = hasHeader ? records.slice(1) : records
  const dataLines = data.map((r) => serializeRecord(r, delimiter)).sort()
  const headerLines = header.map((r) => serializeRecord(r, delimiter))
  return [...headerLines, ...dataLines].join('\n')
}
