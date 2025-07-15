import { useCallback, useEffect, useState } from 'react'
import type { CompareOptions, CompareResult, ProgressUpdate } from '../../../shared/types'
import { isFtpUrl } from '../../../shared/ftp'

export interface CompareState {
  comparing: boolean
  progress: ProgressUpdate | null
  error: string | null
  /** Runs a comparison and resolves with the result (or null on error/cancel). */
  run: (
    leftRoot: string,
    rightRoot: string,
    options: CompareOptions,
    password?: string
  ) => Promise<CompareResult | null>
  cancel: () => void
}

export function useCompare(): CompareState {
  const [comparing, setComparing] = useState(false)
  const [progress, setProgress] = useState<ProgressUpdate | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return window.api.onProgress((update) => setProgress(update))
  }, [])

  const run = useCallback(
    async (
      leftRoot: string,
      rightRoot: string,
      options: CompareOptions,
      password?: string
    ): Promise<CompareResult | null> => {
      setComparing(true)
      setError(null)
      setProgress({ phase: 'walking', processed: 0, total: 0 })
      try {
        // A side given as ftp:// is mirrored to a temp folder in main, then compared.
        if (isFtpUrl(leftRoot) || isFtpUrl(rightRoot)) {
          return await window.api.compareRemote(leftRoot, rightRoot, options, password)
        }
        return await window.api.compare({ leftRoot, rightRoot, options })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(/cancel/i.test(msg) ? null : msg)
        return null
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

  return { comparing, progress, error, run, cancel }
}
