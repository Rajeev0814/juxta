// pdf-parse@1.x ships no types, and we import the inner module directly to skip
// its debug-mode wrapper (which reads a bundled test PDF when module.parent is unset).
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string
    numpages: number
    info: unknown
    metadata: unknown
    version: string
  }
  function pdf(dataBuffer: Buffer): Promise<PdfParseResult>
  export default pdf
}
