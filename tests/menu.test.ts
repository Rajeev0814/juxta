import { describe, expect, it, vi } from 'vitest'
import { buildMenuTemplate, type MenuActionId } from '../src/main/menu'
import type { MenuItemConstructorOptions } from 'electron'

interface FlatItem {
  label?: string
  accelerator?: string
  click?: () => void
}

function flatten(template: MenuItemConstructorOptions[]): FlatItem[] {
  const out: FlatItem[] = []
  for (const top of template) {
    const sub = top.submenu
    if (Array.isArray(sub)) {
      for (const item of sub) {
        out.push({ label: item.label, accelerator: item.accelerator, click: item.click as (() => void) | undefined })
      }
    }
  }
  return out
}

describe('buildMenuTemplate', () => {
  it('exposes the core compare actions with their accelerators', () => {
    const send = vi.fn<(id: MenuActionId) => void>()
    const items = flatten(buildMenuTemplate(send, { isDev: false, isMac: false }))
    const byLabel = (l: string): FlatItem | undefined => items.find((i) => i.label === l)

    expect(byLabel('Compare')?.accelerator).toBe('F5')
    expect(byLabel('Next Difference')?.accelerator).toBe('F4')
    expect(byLabel('Previous Difference')?.accelerator).toBe('Shift+F4')
    expect(byLabel('Swap Sides')?.accelerator).toBe('CmdOrCtrl+Shift+S')
    expect(byLabel('Toggle Theme')).toBeDefined()
  })

  it('clicking an action item dispatches the matching action id', () => {
    const send = vi.fn<(id: MenuActionId) => void>()
    const items = flatten(buildMenuTemplate(send, { isDev: false, isMac: false }))
    items.find((i) => i.label === 'Compare')?.click?.()
    items.find((i) => i.label === 'Next Difference')?.click?.()
    expect(send).toHaveBeenCalledWith('compare')
    expect(send).toHaveBeenCalledWith('nextDiff')
  })

  it('only includes dev-only items (reload/devtools) in dev', () => {
    const prod = buildMenuTemplate(vi.fn(), { isDev: false, isMac: false })
    const dev = buildMenuTemplate(vi.fn(), { isDev: true, isMac: false })
    const hasReload = (t: MenuItemConstructorOptions[]): boolean =>
      t.some((top) => Array.isArray(top.submenu) && top.submenu.some((i) => i.role === 'reload'))
    expect(hasReload(prod)).toBe(false)
    expect(hasReload(dev)).toBe(true)
  })
})
