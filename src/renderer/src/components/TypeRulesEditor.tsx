import React from 'react'
import type { FileTypeRule } from '../../../shared/types'

interface Props {
  rules: FileTypeRule[]
  onChange: (rules: FileTypeRule[]) => void
  onClose: () => void
}

type BoolKey = 'ignoreWhitespace' | 'ignoreCase' | 'ignoreBlankLines'

const TOGGLES: Array<{ key: BoolKey; label: string }> = [
  { key: 'ignoreWhitespace', label: 'Ignore WS' },
  { key: 'ignoreCase', label: 'Ignore case' },
  { key: 'ignoreBlankLines', label: 'Ignore blank' }
]

/**
 * Edit per-file-type rules: each glob (e.g. "*.md") forces the checked
 * normalizations on for matching files, overriding the global filters.
 */
export function TypeRulesEditor({ rules, onChange, onClose }: Props): React.JSX.Element {
  const update = (i: number, patch: Partial<FileTypeRule>): void =>
    onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const toggle = (i: number, key: BoolKey, on: boolean): void => {
    const next = { ...rules[i] }
    if (on) next[key] = true
    else delete next[key]
    onChange(rules.map((r, idx) => (idx === i ? next : r)))
  }

  const add = (): void => onChange([...rules, { glob: '' }])
  const remove = (i: number): void => onChange(rules.filter((_, idx) => idx !== i))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal type-rules" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Per-file-type rules</span>
          <button className="modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="tr-body">
          {rules.length === 0 && (
            <p className="tr-hint">
              No rules. Add one to force whitespace/case/blank-line handling for files matching a glob
              (e.g. <code>*.md</code>, <code>*.min.js</code>). These override the global filters; JSON/YAML/XML/CSV
              already normalize by extension.
            </p>
          )}
          {rules.map((rule, i) => (
            <div className="tr-row" key={i}>
              <input
                className="tr-glob"
                type="text"
                placeholder="*.md"
                value={rule.glob}
                spellCheck={false}
                onChange={(e) => update(i, { glob: e.target.value })}
              />
              {TOGGLES.map((t) => (
                <label key={t.key} className="opt checkbox">
                  <input type="checkbox" checked={!!rule[t.key]} onChange={(e) => toggle(i, t.key, e.target.checked)} />
                  {t.label}
                </label>
              ))}
              <button className="tr-remove" onClick={() => remove(i)} title="Remove rule">
                🗑
              </button>
            </div>
          ))}
        </div>

        <div className="tr-footer">
          <button onClick={add}>+ Add rule</button>
        </div>
      </div>
    </div>
  )
}
