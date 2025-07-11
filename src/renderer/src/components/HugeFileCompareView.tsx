import React, { useCallback, useEffect, useState } from 'react'

interface Props {
  left: string
  right: string
}

const WINDOW = 4096 // bytes shown per side per page

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`
}

/**
 * Byte-range hex viewer for files too large for the editor. Reads a fixed window
 * from each side on demand (never loading the whole file) and can jump to the
 * first differing byte via a streaming scan in the main process.
 */
export function HugeFileCompareView({ left, right }: Props): React.JSX.Element {
  const [offset, setOffset] = useState(0)
  const [leftHex, setLeftHex] = useState('')
  const [rightHex, setRightHex] = useState('')
  const [leftSize, setLeftSize] = useState(0)
  const [rightSize, setRightSize] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([window.api.readFileRange(left, offset, WINDOW), window.api.readFileRange(right, offset, WINDOW)])
      .then(([l, r]) => {
        if (cancelled) return
        setLeftHex(l.hex)
        setRightHex(r.hex)
        setLeftSize(l.size)
        setRightSize(r.size)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [left, right, offset])

  const maxSize = Math.max(leftSize, rightSize)
  const clampToPage = (o: number): number => Math.max(0, Math.min(o, Math.max(0, maxSize - 1)))
  const step = (delta: number): void => setOffset((o) => clampToPage(o + delta))

  const jumpToDiff = useCallback(async (): Promise<void> => {
    setNote(null)
    const d = await window.api.firstDifference(left, right)
    if (d.offset < 0) {
      setNote(d.leftSize === d.rightSize ? 'Files are identical.' : 'Common prefix identical; sizes differ.')
      return
    }
    // Align the window to a 16-byte row so the differing byte is easy to spot.
    setOffset(Math.max(0, d.offset - (d.offset % 16)))
    setNote(`First difference at offset 0x${d.offset.toString(16)} (${d.offset}).`)
  }, [left, right])

  if (error) return <div className="fc-message error">Failed to read files: {error}</div>

  const pageEnd = Math.min(offset + WINDOW, maxSize)

  return (
    <div className="file-compare">
      <div className="file-compare-bar">
        <span className="fc-name">Large-file hex</span>
        <span className="fc-enc">
          L {fmtSize(leftSize)} · R {fmtSize(rightSize)}
          {leftSize !== rightSize ? ' (sizes differ)' : ''}
        </span>
        <div className="fc-actions">
          <button onClick={() => setOffset(0)} disabled={offset === 0} title="Start">
            ⏮
          </button>
          <button onClick={() => step(-WINDOW)} disabled={offset === 0} title="Previous window">
            ◀
          </button>
          <span className="fc-count" title="Byte range shown">
            0x{offset.toString(16)}–0x{pageEnd.toString(16)}
          </span>
          <button onClick={() => step(WINDOW)} disabled={pageEnd >= maxSize} title="Next window">
            ▶
          </button>
          <span className="fc-sep" />
          <button className="primary" onClick={() => void jumpToDiff()} title="Scan for the first differing byte">
            ⚑ First difference
          </button>
        </div>
      </div>
      {note && <div className="banner">{note}</div>}
      <div className="file-compare-body huge-hex">
        <pre className="hex-pane">{leftHex}</pre>
        <pre className="hex-pane">{rightHex}</pre>
      </div>
    </div>
  )
}
