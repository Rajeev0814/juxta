import { describe, expect, it } from 'vitest'
import { compareFolders } from '../src/core/compare'
import { toHtmlReport } from '../src/shared/report'
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
