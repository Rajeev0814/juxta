import { describe, expect, it } from 'vitest'
import { compareFolders } from '../src/core/compare'
import { toCsvReport, toHtmlReport } from '../src/shared/report'
import { DEFAULT_FILTERS, type CompareOptions } from '../src/shared/types'
import { makeTree } from './helpers'

const options: CompareOptions = { method: 'content', filters: { ...DEFAULT_FILTERS, excludeGlobs: [] } }

describe('toHtmlReport', () => {
  it('includes roots, summary counts and changed rows; escapes HTML', async () => {
    const left = await makeTree({ 'a&b.txt': 'one', 'same.txt': 'x', 'l.txt': 'L' })
    const right = await makeTree({ 'a&b.txt': 'two', 'same.txt': 'x' })
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options })
    const html = toHtmlReport(res)

    expect(html).toContain('<!doctype html>')
    expect(html).toContain(left) // left root path
    expect(html).toContain('Different')
    expect(html).toContain('Left only')
    expect(html).toContain('a&amp;b.txt') // escaped, listed (changed)
    expect(html).not.toContain('>same.txt<') // identical rows omitted from the table
  })
})

describe('toCsvReport', () => {
  it('lists changed files with status/sizes, a header, and CRLF rows; omits identical', async () => {
    const left = await makeTree({ 'a,b.txt': 'one', 'same.txt': 'x', 'l.txt': 'L' })
    const right = await makeTree({ 'a,b.txt': 'two', 'same.txt': 'x' })
    const res = await compareFolders({ leftRoot: left, rightRoot: right, options })
    const csv = toCsvReport(res)
    const lines = csv.split('\r\n')

    expect(lines[0]).toBe('Path,Status,Left size,Right size')
    expect(csv).toContain('"a,b.txt"') // comma in path is quoted
    expect(csv).toContain('Different')
    expect(csv).toContain('Left only')
    expect(csv).not.toContain('same.txt') // identical omitted
  })
})
