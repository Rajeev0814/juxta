import { useCallback, useEffect, useRef, useState } from 'react'
import type { CompareOptions, CompareResult, ProgressUpdate } from '../../../shared/types'

export interface CompareState {
  result: CompareResult | null
  comparing: boolean
  progress: ProgressUpdate | null
  error: string | null
  run: (leftRoot: string, rightRoot: string, options: CompareOptions) => Promise<void>
  cancel: () => void
  reset: () => void
}

export function useCompare(): CompareState {
  const [result, setResult] = useState<CompareResult | null>(null)
  const [comparing, setComparing] = useState(false)
  const [progress, setProgress] = useState<ProgressUpdate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastArgs = useRef<{ left: string; right: string; options: CompareOptions } | null>(null)

  useEffect(() => {
    // Subscribe to progress events from the worker (via main).
    return window.api.onProgress((update) => setProgress(update))
  }, [])

  const run = useCallback(
    async (leftRoot: string, rightRoot: string, options: CompareOptions) => {
      lastArgs.current = { left: leftRoot, right: rightRoot, options }
      setComparing(true)
      setError(null)
      setProgress({ phase: 'walking', processed: 0, total: 0 })
      try {
        const res = await window.api.compare({ leftRoot, rightRoot, options })
        setResult(res)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // A user-initiated cancellation is a normal stop, not an error.
        setError(/cancel/i.test(msg) ? null : msg)
      } finally {
        setComparing(false)
        setProgress(null)
      }
    },
    []
  )

  const cancel = useCallback(() => {
    void window.api.cancelCompare()
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
    setProgress(null)
  }, [])

  return { result, comparing, progress, error, run, cancel, reset }
}
