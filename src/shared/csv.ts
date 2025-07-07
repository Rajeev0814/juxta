// RFC-4180-ish CSV/TSV parsing, shared by the core canonicalizer and the
// renderer's table-compare view. Pure — no Node imports.

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

/** Tab for .tsv, comma otherwise. */
export function delimiterForPath(path: string): string {
  return /\.tsv$/i.test(path) ? '\t' : ','
}

/** Files the table comparator handles. */
export function isTablePath(path: string): boolean {
  return /\.(csv|tsv)$/i.test(path)
}
