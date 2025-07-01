import React from 'react'

interface Props {
  onClose: () => void
}

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'F5', action: 'Compare / re-compare' },
  { keys: 'F4 / Shift+F4', action: 'Next / previous changed file' },
  { keys: 'F6 / Shift+F6', action: 'Next / previous difference (in a diff view)' },
  { keys: 'Esc', action: 'Close the current file diff' },
  { keys: 'Ctrl+T', action: 'Toggle light / dark theme' },
  { keys: 'Ctrl+Shift+H', action: 'Toggle "hide identical"' },
  { keys: 'Ctrl+Shift+S', action: 'Swap left and right sides' },
  { keys: '?', action: 'Show / hide this help' }
]

/** A modal cheat-sheet of keyboard shortcuts, toggled with `?`. */
export function ShortcutsHelp({ onClose }: Props): React.JSX.Element {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal shortcuts-help" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Keyboard shortcuts</span>
          <button className="modal-close" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>
        <table className="shortcuts-table">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys}>
                <td className="sc-keys">
                  {s.keys.split(' / ').map((k, i) => (
                    <React.Fragment key={k}>
                      {i > 0 && <span className="sc-or"> / </span>}
                      <kbd>{k}</kbd>
                    </React.Fragment>
                  ))}
                </td>
                <td className="sc-action">{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
