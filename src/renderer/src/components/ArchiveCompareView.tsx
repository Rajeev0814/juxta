import { DiffEditor } from '@monaco-editor/react'
import React, { useEffect, useState } from 'react'
import type { CompareNode, CompareResult } from '../../../shared/types'
import { languageForPath } from '../lib/language'
import { juxtaTheme } from '../lib/monacoSetup'
import { TwoPaneTree } from './TwoPaneTree'

interface Props {
  left: string
  right: string
  hideIdentical: boolean
  theme: 'light' | 'dark'
}

interface OpenEntry {
  relPath: string
  leftText: string
  rightText: string
}

/** Compares the contents of two archive files (e.g. .zip) as a read-only tree,
 *  and drills into a selected entry to diff its content. */
export function ArchiveCompareView({ left, right, hideIdentical, theme }: Props): React.JSX.Element {
  const [result, setResult] = useState<CompareResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [entry, setEntry] = useState<OpenEntry | null>(null)
  const [entryLoading, setEntryLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setResult(null)
    setError(null)
    setEntry(null)
    window.api
      .compareArchives(left, right)
      .then((r) => {
        if (!cancelled) setResult(r)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [left, right])

  const openEntry = (node: CompareNode): void => {
    if (node.kind !== 'file') return
    setEntryLoading(true)
    Promise.all([window.api.readArchiveEntry(left, node.relPath), window.api.readArchiveEntry(right, node.relPath)])
      .then(([l, r]) => setEntry({ relPath: node.relPath, leftText: l.text, rightText: r.text }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setEntryLoading(false))
  }

  if (error) return <div className="fc-message error">Failed to read archives: {error}</div>
  if (!result) return <div className="fc-message">Reading archives…</div>

  if (entry) {
    return (
      <div className="file-compare">
        <div className="file-compare-bar">
          <button onClick={() => setEntry(null)} title="Back to the archive tree">
            ← Back
          </button>
          <span className="fc-name">{entry.relPath}</span>
          <span className="fc-hint">inside the archives (read-only)</span>
        </div>
        <div className="file-compare-body">
          <DiffEditor
            original={entry.leftText}
            modified={entry.rightText}
            language={languageForPath(entry.relPath)}
            theme={juxtaTheme(theme)}
            options={{
              readOnly: true,
              renderSideBySide: true,
              automaticLayout: true,
              minimap: { enabled: true, renderCharacters: false },
              scrollBeyondLastLine: false,
              fontSize: 12
            }}
          />
        </div>
      </div>
    )
  }

  const noop = (): void => {}
  return (
    <>
      {entryLoading && <div className="banner">Opening entry…</div>}
      <TwoPaneTree
        result={result}
        hideIdentical={hideIdentical}
        selectedRelPath={selected}
        reveal={null}
        onSelect={(n: CompareNode) => setSelected(n.relPath)}
        onOpenFile={openEntry}
        onCopy={noop}
        onDelete={noop}
        onCopyTime={noop}
        readOnly
      />
    </>
  )
}
