// Extract readable text from Office Open XML documents (.docx / .xlsx). These
// are just zip archives of XML, so we reuse adm-zip + fast-xml-parser (already
// bundled) — no native Office dependency. The extracted text is diffed as
// plain text, mirroring the PDF comparator.
import AdmZip from 'adm-zip'
import { XMLParser } from 'fast-xml-parser'

/** Read a text value that may be a bare string or a `{ '#text': ... }` node. */
function textOf(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (node && typeof node === 'object' && '#text' in node) {
    return String((node as Record<string, unknown>)['#text'] ?? '')
  }
  return ''
}

/** Coerce fast-xml-parser's "single or array" shape into an array. */
function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

// --- .docx ---------------------------------------------------------------

const orderedParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: true,
  trimValues: false
})

/**
 * Walk a preserveOrder node list, emitting text. Works for both WordprocessingML
 * (w:t / w:p) and DrawingML used by slides (a:t / a:p) by matching tag suffixes:
 * `:t` = text run, `:p` = paragraph, `:tab` = tab, `:br`/`:cr` = line break.
 */
function walkOoxmlText(nodes: unknown[], out: string[]): void {
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const rec = node as Record<string, unknown>
    const tag = Object.keys(rec).find((k) => k !== ':@')
    if (!tag || tag === '#text') continue
    const children = rec[tag] as unknown[]
    if (tag.endsWith(':tab')) {
      out.push('\t')
    } else if (tag.endsWith(':br') || tag.endsWith(':cr')) {
      out.push('\n')
    } else if (tag.endsWith(':t')) {
      for (const c of asArray(children)) out.push(textOf(c))
    } else if (tag.endsWith(':p')) {
      walkOoxmlText(asArray(children), out)
      out.push('\n')
    } else if (Array.isArray(children)) {
      walkOoxmlText(children, out)
    }
  }
}

function extractXmlPartText(zip: AdmZip, part: string): string {
  const xml = zip.readAsText(part)
  if (!xml) return ''
  const out: string[] = []
  walkOoxmlText(orderedParser.parse(xml) as unknown[], out)
  return out.join('')
}

function extractDocx(zip: AdmZip): string {
  return extractXmlPartText(zip, 'word/document.xml').replace(/\n{3,}/g, '\n\n').trimEnd()
}

function extractPptx(zip: AdmZip): string {
  const slides = zip
    .getEntries()
    .map((e) => e.entryName)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)![1])
      const nb = Number(b.match(/slide(\d+)\.xml$/)![1])
      return na - nb
    })
  return slides
    .map((name, i) => `# Slide ${i + 1}\n${extractXmlPartText(zip, name).replace(/\n{3,}/g, '\n\n').trim()}`)
    .join('\n\n')
    .trimEnd()
}

// --- .xlsx ---------------------------------------------------------------

const cellParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false
})

function parseSharedStrings(zip: AdmZip): string[] {
  const xml = zip.readAsText('xl/sharedStrings.xml')
  if (!xml) return []
  const doc = cellParser.parse(xml) as Record<string, any>
  return asArray(doc?.sst?.si).map((si: any) => {
    if (si?.r !== undefined) return asArray(si.r).map((r: any) => textOf(r?.t)).join('')
    return textOf(si?.t)
  })
}

function cellText(cell: any, shared: string[]): string {
  if (cell?.['@_t'] === 's') return shared[Number(textOf(cell?.v))] ?? ''
  if (cell?.['@_t'] === 'inlineStr') return textOf(cell?.is?.t)
  return textOf(cell?.v)
}

function extractXlsx(zip: AdmZip): string {
  const shared = parseSharedStrings(zip)
  const sheets = zip
    .getEntries()
    .map((e) => e.entryName)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/sheet(\d+)\.xml$/)![1])
      const nb = Number(b.match(/sheet(\d+)\.xml$/)![1])
      return na - nb
    })

  const parts: string[] = []
  for (const name of sheets) {
    const doc = cellParser.parse(zip.readAsText(name)) as Record<string, any>
    const rows = asArray(doc?.worksheet?.sheetData?.row)
    const label = name.match(/(sheet\d+)\.xml$/)![1]
    const lines = rows.map((row: any) => asArray(row?.c).map((c: any) => cellText(c, shared)).join('\t'))
    parts.push(`# ${label}\n${lines.join('\n')}`)
  }
  return parts.join('\n\n').trimEnd()
}

// --- dispatcher ----------------------------------------------------------

/** Extract plain text from a .docx / .xlsx / .pptx file. */
export function extractOfficeText(path: string): string {
  const zip = new AdmZip(path)
  if (/\.xlsx$/i.test(path)) return extractXlsx(zip)
  if (/\.pptx$/i.test(path)) return extractPptx(zip)
  return extractDocx(zip)
}
