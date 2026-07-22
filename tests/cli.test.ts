import { describe, expect, it } from 'vitest'
import { parseCliArgs, formatCliReport, machineSummaryLine } from '../src/shared/cli'
import type { CompareNode, CompareResult } from '../src/shared/types'

describe('parseCliArgs', () => {
  it('returns null without --cli', () => {
    expect(parseCliArgs(['Juxta.exe', 'a', 'b'])).toBeNull()
  })

  it('reads the two positional paths', () => {
    expect(parseCliArgs(['Juxta.exe', '--cli', '/a', '/b'])).toMatchObject({ left: '/a', right: '/b' })
  })

  it('requires two positionals', () => {
    expect(parseCliArgs(['Juxta.exe', '--cli', '/a'])).toBeNull()
  })

  it('parses options: out, method, include/exclude lists', () => {
    const o = parseCliArgs([
      '--cli',
      'L',
      'R',
      '--out',
      'report.csv',
      '--method',
      'quick',
      '--exclude',
      'node_modules/, *.log',
      '--include',
      '*.ts'
    ])
    expect(o).toEqual({
      left: 'L',
      right: 'R',
      out: 'report.csv',
      method: 'quick',
      exclude: ['node_modules/', '*.log'],
      include: ['*.ts'],
      quiet: false,
      verbose: false
    })
  })

  it('ignores an invalid method', () => {
    expect(parseCliArgs(['--cli', 'L', 'R', '--method', 'bogus'])?.method).toBeUndefined()
  })

  it('parses --verbose/-v and --quiet/-q without eating positionals', () => {
    expect(parseCliArgs(['--cli', 'L', 'R', '--verbose'])).toMatchObject({
      left: 'L',
      right: 'R',
      verbose: true,
      quiet: false
    })
    expect(parseCliArgs(['--cli', '-q', 'L', '-v', 'R'])).toMatchObject({
      left: 'L',
      right: 'R',
      verbose: true,
      quiet: true
    })
  })
})

/** Build a folder-comparison result fixture with two changed files. */
function makeResult(): CompareResult {
  const files: CompareNode[] = [
    { name: 'a.txt', relPath: 'a.txt', kind: 'file', status: 'different' },
    { name: 'gone.txt', relPath: 'sub/gone.txt', kind: 'file', status: 'leftOnly' },
    { name: 'same.txt', relPath: 'same.txt', kind: 'file', status: 'identical' }
  ]
  return {
    leftRoot: 'C:/L',
    rightRoot: 'C:/R',
    options: {} as CompareResult['options'],
    root: { name: '', relPath: '', kind: 'directory', status: 'different', children: files },
    summary: { identical: 1, different: 1, leftOnly: 1, rightOnly: 0, moved: 0, totalFiles: 3 },
    moves: [],
    elapsedMs: 5
  }
}

describe('formatCliReport', () => {
  it('quiet mode returns only the machine summary line', () => {
    const r = makeResult()
    const out = formatCliReport(r, { quiet: true })
    expect(out).toBe(machineSummaryLine(r))
    expect(out).toBe('different=1 leftOnly=1 rightOnly=0 moved=0 identical=1 files=3')
    expect(out).not.toContain('\n')
  })

  it('default mode prints roots, aligned counts and a verdict', () => {
    const out = formatCliReport(makeResult())
    expect(out).toContain('left:  C:/L')
    expect(out).toContain('right: C:/R')
    expect(out).toContain('different')
    expect(out).toContain('total files')
    expect(out).toContain('Result: differences found')
    // Not verbose: no per-file listing.
    expect(out).not.toContain('a.txt')
  })

  it('verbose mode lists each changed file with a status tag', () => {
    const out = formatCliReport(makeResult(), { verbose: true })
    expect(out).toContain('Changed files:')
    expect(out).toContain('~ a.txt')
    expect(out).toContain('< sub/gone.txt')
    // Identical files are not listed.
    expect(out).not.toContain('same.txt')
  })

  it('reports identical when there are no differences', () => {
    const r = makeResult()
    r.summary = { identical: 3, different: 0, leftOnly: 0, rightOnly: 0, moved: 0, totalFiles: 3 }
    r.root.children = [{ name: 'same.txt', relPath: 'same.txt', kind: 'file', status: 'identical' }]
    expect(formatCliReport(r)).toContain('Result: identical')
  })
})
