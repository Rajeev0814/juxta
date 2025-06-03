import type { MenuItemConstructorOptions } from 'electron'

export type MenuActionId =
  | 'compare'
  | 'cancel'
  | 'nextDiff'
  | 'prevDiff'
  | 'toggleTheme'
  | 'toggleHideIdentical'
  | 'swapSides'
  | 'about'

export interface MenuEnv {
  isDev: boolean
  isMac: boolean
}

/**
 * Build the application menu template. Kept as a pure data builder (no Menu
 * instantiation) so it can be unit-tested. Action items dispatch to the
 * renderer via `send`; accelerators here are the single source for F4/F5 etc.
 */
export function buildMenuTemplate(
  send: (id: MenuActionId) => void,
  env: MenuEnv
): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = []

  if (env.isMac) {
    template.push({ role: 'appMenu' })
  }

  template.push(
    {
      label: 'File',
      submenu: [
        { label: 'Compare', accelerator: 'F5', click: () => send('compare') },
        { label: 'Cancel Comparison', click: () => send('cancel') },
        { type: 'separator' },
        env.isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Theme', accelerator: 'CmdOrCtrl+T', click: () => send('toggleTheme') },
        {
          label: 'Hide Identical',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => send('toggleHideIdentical')
        },
        { type: 'separator' },
        ...(env.isDev ? ([{ role: 'reload' }, { role: 'toggleDevTools' }] as MenuItemConstructorOptions[]) : []),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Compare',
      submenu: [
        { label: 'Next Difference', accelerator: 'F4', click: () => send('nextDiff') },
        { label: 'Previous Difference', accelerator: 'Shift+F4', click: () => send('prevDiff') },
        { type: 'separator' },
        { label: 'Swap Sides', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('swapSides') }
      ]
    },
    {
      role: 'help',
      submenu: [{ label: 'About Juxta', click: () => send('about') }]
    }
  )

  return template
}
