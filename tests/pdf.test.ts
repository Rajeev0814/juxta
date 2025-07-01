import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { isPdfPath } from '../src/shared/pdf'

const FIXTURE = join(__dirname, 'fixtures', 'extractPdf.cjs')

/**
 * Extract text from a generated PDF via a real Node process. pdf-parse bundles
 * a webpack build of pdf.js that vitest's module runner corrupts; the app runs
 * it as-is in the Electron main process, and this mirrors that runtime exactly.
 */
function extract(text: string): { text: string; numpages: number } {
  const out = execFileSync(process.execPath, [FIXTURE, text], { encoding: 'utf8' })
  return JSON.parse(out)
}

describe('isPdfPath', () => {
  it('matches .pdf case-insensitively', () => {
    expect(isPdfPath('report.pdf')).toBe(true)
    expect(isPdfPath('C:/docs/Spec.PDF')).toBe(true)
    expect(isPdfPath('notes.txt')).toBe(false)
    expect(isPdfPath('archive.pdf.zip')).toBe(false)
  })
})

describe('pdf text extraction', () => {
  it('extracts embedded text and page count', () => {
    const data = extract('Hello Juxta PDF')
    expect(data.text).toContain('Hello Juxta PDF')
    expect(data.numpages).toBe(1)
  })

  it('yields differing text for differing documents', () => {
    expect(extract('Version one').text.trim()).not.toBe(extract('Version two').text.trim())
  })
})
