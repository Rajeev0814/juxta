import { describe, expect, it } from 'vitest'
import { canonicalizeCsv, parseCsv } from '../src/core/csv'

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\n1,2', ',')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
  })
  it('handles quoted fields with embedded delimiters and quotes', () => {
    expect(parseCsv('"a,b","c""d"', ',')).toEqual([['a,b', 'c"d']])
  })
  it('handles quoted newlines', () => {
    expect(parseCsv('"line1\nline2",x', ',')).toEqual([['line1\nline2', 'x']])
  })
  it('supports tab delimiter', () => {
    expect(parseCsv('a\tb', '\t')).toEqual([['a', 'b']])
  })
})

describe('canonicalizeCsv', () => {
  it('ignores data-row order (header stays first)', () => {
    const a = canonicalizeCsv('id,name\n2,bob\n1,amy', { delimiter: ',' })
    const b = canonicalizeCsv('id,name\n1,amy\n2,bob', { delimiter: ',' })
    expect(a).toBe(b)
    expect(a.split('\n')[0]).toBe('id,name') // header preserved on top
  })
  it('distinguishes different content', () => {
    const a = canonicalizeCsv('id\n1\n2', { delimiter: ',' })
    const b = canonicalizeCsv('id\n1\n3', { delimiter: ',' })
    expect(a).not.toBe(b)
  })
  it('returns input unchanged when empty', () => {
    expect(canonicalizeCsv('', {})).toBe('')
  })
})
