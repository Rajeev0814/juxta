import React, { useEffect, useRef, useState } from 'react'
import { pixelDiff } from '../../../shared/image'

interface Props {
  left: string
  right: string
}

type Mode = 'side' | 'overlay' | 'swipe' | 'diff'

interface Loaded {
  leftUrl: string
  rightUrl: string
  leftDim: { w: number; h: number }
  rightDim: { w: number; h: number }
  diffPct: number | null // null when dimensions differ
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode failed'))
    img.src = url
  })
}

/** Compare two image files: side-by-side, opacity overlay, or pixel-difference. */
export function ImageCompareView({ left, right }: Props): React.JSX.Element {
  const [state, setState] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('side')
  const [opacity, setOpacity] = useState(0.5)
  const [swipe, setSwipe] = useState(50)
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const maskRef = useRef<{ mask: Uint8ClampedArray; w: number; h: number; base: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setState(null)
    setError(null)
    maskRef.current = null
    const run = async (): Promise<void> => {
      try {
        const [lu, ru] = await Promise.all([window.api.readImage(left), window.api.readImage(right)])
        if (!lu || !ru) throw new Error('could not read image (too large or unreadable)')
        const [li, ri] = await Promise.all([loadImage(lu), loadImage(ru)])
        if (cancelled) return
        const leftDim = { w: li.naturalWidth, h: li.naturalHeight }
        const rightDim = { w: ri.naturalWidth, h: ri.naturalHeight }
        let diffPct: number | null = null
        if (leftDim.w === rightDim.w && leftDim.h === rightDim.h && leftDim.w > 0) {
          const { w, h } = leftDim
          const ca = document.createElement('canvas')
          ca.width = w
          ca.height = h
          const cb = document.createElement('canvas')
          cb.width = w
          cb.height = h
          const ax = ca.getContext('2d')!
          const bx = cb.getContext('2d')!
          ax.drawImage(li, 0, 0)
          bx.drawImage(ri, 0, 0)
          const da = ax.getImageData(0, 0, w, h).data
          const db = bx.getImageData(0, 0, w, h).data
          const result = pixelDiff(da, db, 0)
          diffPct = result.totalPixels ? (result.diffPixels / result.totalPixels) * 100 : 0
          maskRef.current = { mask: result.mask, w, h, base: lu }
        }
        setState({ leftUrl: lu, rightUrl: ru, leftDim, rightDim, diffPct })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [left, right])

  // Render the difference view (base image + red mask overlay) on demand.
  useEffect(() => {
    if (mode !== 'diff' || !maskRef.current || !diffCanvasRef.current) return
    const { mask, w, h, base } = maskRef.current
    const canvas = diffCanvasRef.current
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    void loadImage(base).then((img) => {
      ctx.drawImage(img, 0, 0)
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = w
      maskCanvas.height = h
      const maskCtx = maskCanvas.getContext('2d')!
      const md = maskCtx.createImageData(w, h)
      md.data.set(mask)
      maskCtx.putImageData(md, 0, 0)
      ctx.drawImage(maskCanvas, 0, 0)
    })
  }, [mode, state])

  const dimText = (d: { w: number; h: number }): string => `${d.w}×${d.h}`

  return (
    <div className="file-compare">
      <div className="file-compare-bar">
        <span className="fc-name">Image Compare</span>
        {state && (
          <span className="fc-enc">
            {dimText(state.leftDim)}
            {state.leftDim.w === state.rightDim.w && state.leftDim.h === state.rightDim.h
              ? ''
              : ` vs ${dimText(state.rightDim)} (differ)`}
            {state.diffPct !== null ? ` · ${state.diffPct.toFixed(2)}% different` : ''}
          </span>
        )}
        <div className="fc-actions">
          <button className={mode === 'side' ? 'primary' : ''} onClick={() => setMode('side')}>
            Side by side
          </button>
          <button className={mode === 'overlay' ? 'primary' : ''} onClick={() => setMode('overlay')}>
            Overlay
          </button>
          <button className={mode === 'swipe' ? 'primary' : ''} onClick={() => setMode('swipe')}>
            Swipe
          </button>
          <button
            className={mode === 'diff' ? 'primary' : ''}
            onClick={() => setMode('diff')}
            disabled={!maskRef.current}
            title={maskRef.current ? 'Pixel difference' : 'Difference needs matching dimensions'}
          >
            Difference
          </button>
          {mode === 'overlay' && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              title="Right image opacity"
            />
          )}
          {mode === 'swipe' && (
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={swipe}
              onChange={(e) => setSwipe(Number(e.target.value))}
              title="Swipe position"
            />
          )}
        </div>
      </div>

      <div className="file-compare-body image-compare">
        {error && <div className="fc-message error">Failed to load images: {error}</div>}
        {!error && !state && <div className="fc-message">Loading images…</div>}
        {!error && state && mode === 'side' && (
          <div className="img-side">
            <div className="img-pane">
              <img src={state.leftUrl} alt="left" />
            </div>
            <div className="img-pane">
              <img src={state.rightUrl} alt="right" />
            </div>
          </div>
        )}
        {!error && state && mode === 'overlay' && (
          <div className="img-overlay">
            <img src={state.leftUrl} alt="left" />
            <img src={state.rightUrl} alt="right" style={{ opacity }} />
          </div>
        )}
        {!error && state && mode === 'swipe' && (
          <div className="img-swipe">
            <img src={state.leftUrl} alt="left" />
            <img
              src={state.rightUrl}
              alt="right"
              className="swipe-top"
              style={{ clipPath: `inset(0 0 0 ${swipe}%)` }}
            />
            <div className="swipe-divider" style={{ left: `${swipe}%` }} />
          </div>
        )}
        {!error && state && mode === 'diff' && (
          <div className="img-diff">
            <canvas ref={diffCanvasRef} />
          </div>
        )}
      </div>
    </div>
  )
}
