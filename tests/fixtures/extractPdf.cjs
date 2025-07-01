// Test helper, run as a standalone Node process (matching the Electron main
// runtime, where pdf-parse is required as-is). Builds a minimal single-page PDF
// containing the text in argv[2], extracts it with pdf-parse, and prints JSON.
//
// Run under vitest's module runner, pdf-parse's pre-bundled (webpack) pdf.js is
// corrupted by Vite's transform — so we shell out to real Node instead.
const path = require('node:path')
const pdfParse = require(path.join(__dirname, '..', '..', 'node_modules', 'pdf-parse', 'lib', 'pdf-parse.js'))

/** Build a minimal, structurally-valid single-page PDF containing `text`. */
function buildPdf(text) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null, // content stream, filled below
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  const stream = `BT /F1 18 Tf 20 100 Td (${text}) Tj ET`
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`

  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((body, i) => {
    offsets[i] = Buffer.byteLength(pdf, 'latin1')
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefStart = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((off) => {
    pdf += String(off).padStart(10, '0') + ' 00000 n \n'
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}

;(async () => {
  const text = process.argv[2] || 'Hello Juxta PDF'
  const data = await pdfParse(buildPdf(text))
  process.stdout.write(JSON.stringify({ text: data.text, numpages: data.numpages }))
})().catch((err) => {
  process.stderr.write(String(err && err.message ? err.message : err))
  process.exit(1)
})
