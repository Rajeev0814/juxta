import React, { useEffect, useState } from 'react'
import type { CompareNode, CompareResult } from '../../../shared/types'
import { TwoPaneTree } from './TwoPaneTree'

interface Props {
  left: string
  right: string
  hideIdentical: boolean
}

/** Compares the contents of two archive files (e.g. .zip) as a read-only tree. */
export function ArchiveCompareView({ left, right, hideIdentical }: Props): React.JSX.Element {
  const [result, setResult] = useState<CompareResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setResult(null)
    setError(null)
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

  if (error) return <div className="fc-message error">Failed to read archives: {error}</div>
  if (!result) return <div className="fc-message">Reading archives…</div>

  const noop = (): void => {}
  return (
    <TwoPaneTree
      result={result}
      hideIdentical={hideIdentical}
      selectedRelPath={selected}
      reveal={null}
      onSelect={(n: CompareNode) => setSelected(n.relPath)}
      onOpenFile={noop}
      onCopy={noop}
      onDelete={noop}
      onCopyTime={noop}
      readOnly
    />
  )
}
