import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import { afterAll, describe, expect, it } from 'vitest'
import { extractOfficeText } from '../src/core/office'
import { isOfficePath } from '../src/shared/office'

describe('isOfficePath', () => {
  it('matches docx/xlsx/pptx case-insensitively', () => {
    expect(isOfficePath('report.docx')).toBe(true)
    expect(isOfficePath('Data.XLSX')).toBe(true)
    expect(isOfficePath('slides.pptx')).toBe(true)
    expect(isOfficePath('notes.txt')).toBe(false)
  })
})

describe('extractOfficeText', () => {
  let dir: string
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('extracts paragraph text from a .docx', async () => {
    dir = await mkdtemp(join(tmpdir(), 'juxta-office-'))
    const zip = new AdmZip()
    zip.addFile(
      'word/document.xml',
      Buffer.from(
        '<?xml version="1.0"?><w:document xmlns:w="ns"><w:body>' +
          '<w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t> World</w:t></w:r></w:p>' +
          '<w:p><w:r><w:t>Second line</w:t></w:r></w:p>' +
          '</w:body></w:document>',
        'utf8'
      )
    )
    const path = join(dir, 'doc.docx')
    zip.writeZip(path)

    const text = extractOfficeText(path)
    expect(text).toContain('Hello World')
    expect(text).toContain('Second line')
    expect(text.indexOf('Hello World')).toBeLessThan(text.indexOf('Second line'))
  })

  it('extracts cell values from a .xlsx (resolving shared strings)', async () => {
    const zip = new AdmZip()
    zip.addFile(
      'xl/sharedStrings.xml',
      Buffer.from('<sst><si><t>Name</t></si><si><t>Alice</t></si></sst>', 'utf8')
    )
    zip.addFile(
      'xl/worksheets/sheet1.xml',
      Buffer.from(
        '<worksheet><sheetData>' +
          '<row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>42</v></c></row>' +
          '<row><c r="A2" t="s"><v>1</v></c></row>' +
          '</sheetData></worksheet>',
        'utf8'
      )
    )
    const path = join(dir, 'book.xlsx')
    zip.writeZip(path)

    const text = extractOfficeText(path)
    expect(text).toContain('Name\t42')
    expect(text).toContain('Alice')
  })

  it('extracts slide text from a .pptx in slide order', async () => {
    const zip = new AdmZip()
    const slide = (t: string): Buffer =>
      Buffer.from(
        `<p:sld xmlns:a="ns"><p:cSld><p:spTree><p:sp><p:txBody>` +
          `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>` +
          `</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
        'utf8'
      )
    zip.addFile('ppt/slides/slide1.xml', slide('First slide'))
    zip.addFile('ppt/slides/slide2.xml', slide('Second slide'))
    const path = join(dir, 'deck.pptx')
    zip.writeZip(path)

    const text = extractOfficeText(path)
    expect(text).toContain('First slide')
    expect(text).toContain('Second slide')
    expect(text).toContain('# Slide 1')
    expect(text.indexOf('First slide')).toBeLessThan(text.indexOf('Second slide'))
  })
})
