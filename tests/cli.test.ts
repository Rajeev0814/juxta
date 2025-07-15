import { describe, expect, it } from 'vitest'
import { parseCliArgs } from '../src/shared/cli'

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
      include: ['*.ts']
    })
  })

  it('ignores an invalid method', () => {
    expect(parseCliArgs(['--cli', 'L', 'R', '--method', 'bogus'])?.method).toBeUndefined()
  })
})
