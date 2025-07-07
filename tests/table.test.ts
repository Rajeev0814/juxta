import { describe, expect, it } from 'vitest'
import { diffTables } from '../src/shared/table'

describe('diffTables', () => {
  it('aligns rows by key column, ignoring order, and pinpoints changed cells', () => {
    const left = 'id,name,age\n1,Alice,30\n2,Bob,25\n3,Carol,40'
    const right = 'id,name,age\n2,Bob,26\n1,Alice,30\n4,Dave,50' // 2 changed, 3 removed, 4 added

    const d = diffTables(left, right, { delimiter: ',', keyColumn: 0 })

    expect(d.header).toEqual(['id', 'name', 'age'])
    expect(d.columns).toBe(3)
    expect(d.summary).toEqual({ identical: 1, changed: 1, leftOnly: 1, rightOnly: 1 })

    const byKey = new Map(d.rows.map((r) => [r.key, r]))
    expect(byKey.get('1')!.status).toBe('identical')
    expect(byKey.get('2')!.status).toBe('changed')
    expect(byKey.get('2')!.changedCols).toEqual([2]) // only the age column
    expect(byKey.get('3')!.status).toBe('leftOnly')
    expect(byKey.get('4')!.status).toBe('rightOnly')
  })

  it('honors a non-zero key column', () => {
    const left = 'sku,name\nX1,Widget\nX2,Gadget'
    const right = 'sku,name\nZ9,Widget\nX2,Gizmo' // key = name column
    const d = diffTables(left, right, { keyColumn: 1 })

    const byKey = new Map(d.rows.map((r) => [r.key, r]))
    expect(byKey.get('Widget')!.status).toBe('changed') // sku X1 -> Z9
    expect(byKey.get('Widget')!.changedCols).toEqual([0])
    expect(byKey.get('Gadget')!.status).toBe('leftOnly')
    expect(byKey.get('Gizmo')!.status).toBe('rightOnly')
  })

  it('preserves left order then appends right-only keys', () => {
    const left = 'id\nb\na'
    const right = 'id\na\nc'
    const d = diffTables(left, right)
    expect(d.rows.map((r) => r.key)).toEqual(['b', 'a', 'c'])
  })

  it('supports headerless tables and TSV', () => {
    const d = diffTables('1\ta\n2\tb', '1\ta\n2\tB', { delimiter: '\t', hasHeader: false })
    expect(d.summary).toMatchObject({ identical: 1, changed: 1 })
    const changed = d.rows.find((r) => r.status === 'changed')!
    expect(changed.changedCols).toEqual([1])
  })
})
