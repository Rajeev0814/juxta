import React from 'react'
import type { CompareMethod, CompareOptions } from '../../../shared/types'
import type { CompareProfile } from '../../../shared/settings'
import { FolderPicker } from './FolderPicker'

interface Props {
  leftRoot: string
  rightRoot: string
  options: CompareOptions
  comparing: boolean
  theme: 'light' | 'dark'
  onLeftRoot: (p: string) => void
  onRightRoot: (p: string) => void
  onOptions: (o: CompareOptions) => void
  onCompare: () => void
  onCancel: () => void
  onToggleTheme: () => void
  profiles: CompareProfile[]
  onApplyProfile: (name: string) => void
  onSaveProfile: () => void
}

const METHODS: { value: CompareMethod; label: string }[] = [
  { value: 'content', label: 'Content (hash)' },
  { value: 'sizeAndTime', label: 'Size + timestamp' },
  { value: 'quick', label: 'Quick (size only)' }
]

export function Toolbar(props: Props): React.JSX.Element {
  const { options } = props
  const setFilters = (patch: Partial<CompareOptions['filters']>): void =>
    props.onOptions({ ...options, filters: { ...options.filters, ...patch } })

  const parseGlobs = (s: string): string[] =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)

  return (
    <div className="toolbar">
      <div className="toolbar-row pickers">
        <FolderPicker label="Left" value={props.leftRoot} onChange={props.onLeftRoot} />
        <FolderPicker label="Right" value={props.rightRoot} onChange={props.onRightRoot} />
      </div>

      <div className="toolbar-row options">
        <button
          className="primary compare-btn"
          disabled={props.comparing || !props.leftRoot || !props.rightRoot}
          onClick={props.onCompare}
          title="Compare folders"
        >
          {props.comparing ? 'Comparing…' : '▶ Compare'}
        </button>
        {props.comparing && (
          <button className="cancel-btn" onClick={props.onCancel} title="Cancel the running comparison">
            ✕ Cancel
          </button>
        )}

        <label className="opt">
          Rule:
          <select
            value={options.method}
            onChange={(e) => props.onOptions({ ...options, method: e.target.value as CompareMethod })}
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="opt grow">
          Include:
          <input
            type="text"
            placeholder="*.ts, src/**  (comma separated)"
            defaultValue={options.filters.includeGlobs.join(', ')}
            onBlur={(e) => setFilters({ includeGlobs: parseGlobs(e.target.value) })}
            spellCheck={false}
          />
        </label>

        <label className="opt grow">
          Exclude:
          <input
            type="text"
            placeholder="node_modules/, *.log"
            defaultValue={options.filters.excludeGlobs.join(', ')}
            onBlur={(e) => setFilters({ excludeGlobs: parseGlobs(e.target.value) })}
            spellCheck={false}
          />
        </label>

        <label className="opt checkbox">
          <input
            type="checkbox"
            checked={options.filters.ignoreWhitespace}
            onChange={(e) => setFilters({ ignoreWhitespace: e.target.checked })}
          />
          Ignore whitespace
        </label>

        <label className="opt checkbox">
          <input
            type="checkbox"
            checked={options.filters.ignoreCase}
            onChange={(e) => setFilters({ ignoreCase: e.target.checked })}
          />
          Ignore case
        </label>

        <label className="opt checkbox" title="Apply each root's .gitignore as additional exclusions">
          <input
            type="checkbox"
            checked={options.filters.useGitignore}
            onChange={(e) => setFilters({ useGitignore: e.target.checked })}
          />
          Respect .gitignore
        </label>

        <label className="opt grow" title="Lines matching this regex are ignored when comparing content">
          Ignore lines:
          <input
            type="text"
            placeholder="regex, e.g. ^\s*//"
            defaultValue={options.filters.ignoreLinePattern}
            onBlur={(e) => setFilters({ ignoreLinePattern: e.target.value })}
            spellCheck={false}
          />
        </label>

        <label className="opt checkbox" title="Compare .json files by canonical form (ignore formatting & key order)">
          <input
            type="checkbox"
            checked={options.filters.normalizeJson}
            onChange={(e) => setFilters({ normalizeJson: e.target.checked })}
          />
          JSON-aware
        </label>

        <span className="profiles">
          <select
            className="profile-select"
            value=""
            onChange={(e) => {
              const v = e.target.value
              e.currentTarget.value = ''
              if (v) props.onApplyProfile(v)
            }}
            title="Apply a saved comparison profile"
          >
            <option value="" disabled>
              {props.profiles.length ? 'Profile…' : 'No profiles'}
            </option>
            {props.profiles.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          <button onClick={props.onSaveProfile} title="Save current rule + filters as a profile">
            Save profile
          </button>
        </span>

        <label className="opt checkbox" title="Compare .csv/.tsv files ignoring data-row order">
          <input
            type="checkbox"
            checked={options.filters.normalizeCsv}
            onChange={(e) => setFilters({ normalizeCsv: e.target.checked })}
          />
          CSV-aware
        </label>
      </div>
    </div>
  )
}
