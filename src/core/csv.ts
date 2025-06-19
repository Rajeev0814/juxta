// Minimal RFC-4180-ish CSV/TSV handling, used to compare tabular files while
// ignoring row order (and formatting/quoting noise). Pure + unit-tested.

export function parseCsv(text: string, delimiter: string): string[][] {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  let sawAny = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    sawAny = true
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      record.push(field)
      field = ''
    } else if (c === '\n') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field.length > 0 || record.length > 0 || (sawAny && records.length === 0)) {
    record.push(field)
    records.push(record)
  }
  return records
}

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
