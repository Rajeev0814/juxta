import React, { useState } from 'react'

interface Props {
  /** What we're authenticating to (shown in the dialog). */
  target: string
  onSubmit: (password: string) => void
  onCancel: () => void
}

/** A small password dialog (Electron doesn't support window.prompt). */
export function PasswordPrompt({ target, onSubmit, onCancel }: Props): React.JSX.Element {
  const [value, setValue] = useState('')

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form
        className="modal password-prompt"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(value)
        }}
      >
        <div className="modal-header">
          <span>Password</span>
          <button type="button" className="modal-close" onClick={onCancel} title="Cancel">
            ✕
          </button>
        </div>
        <div className="pw-body">
          <label className="pw-label">
            Password for <span className="pw-target">{target}</span>
          </label>
          <input
            type="password"
            className="pw-input"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancel()
            }}
          />
          <p className="pw-note">Entered per session — not saved.</p>
        </div>
        <div className="pw-footer">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Connect
          </button>
        </div>
      </form>
    </div>
  )
}
