import React, { useState } from 'react'

interface Props {
  label: string
  value: string
  onChange: (path: string) => void
  /** Pick a file instead of a folder. */
  file?: boolean
}

/** A path input supporting the Browse dialog and drag-and-drop of a folder or file. */
export function FolderPicker({ label, value, onChange, file = false }: Props): React.JSX.Element {
  const [dragOver, setDragOver] = useState(false)

  const browse = async (): Promise<void> => {
    const picked = file ? await window.api.selectFile() : await window.api.selectFolder()
    if (picked) onChange(picked)
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    // Electron 32+ removed File.path; resolve the absolute path via webUtils.
    if (dropped) {
      const p = window.api.getPathForFile(dropped)
      if (p) onChange(p)
    }
  }

  return (
    <div
      className={`folder-picker${dragOver ? ' drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <span className="folder-picker-label">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={file ? 'Drop a file here or click Browse…' : 'Drop a folder here or click Browse…'}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      <button onClick={browse}>Browse…</button>
    </div>
  )
}
