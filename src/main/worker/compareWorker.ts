import { parentPort } from 'node:worker_threads'
import { compareFolders, type CompareEngineInput } from '../../core/compare'
import type { CompareOptions } from '../../shared/types'

// Message protocol between the main process and this worker.
export interface WorkerRequest {
  id: number
  leftRoot: string
  rightRoot: string
  options: CompareOptions
}

export type WorkerMessage =
  | { type: 'progress'; id: number; update: Parameters<NonNullable<CompareEngineInput['onProgress']>>[0] }
  | { type: 'result'; id: number; result: Awaited<ReturnType<typeof compareFolders>> }
  | { type: 'error'; id: number; message: string }

if (!parentPort) {
  throw new Error('compareWorker must be run as a worker thread')
}

const port = parentPort

port.on('message', async (req: WorkerRequest) => {
  try {
    const result = await compareFolders({
      leftRoot: req.leftRoot,
      rightRoot: req.rightRoot,
      options: req.options,
      onProgress: (update) => {
        port.postMessage({ type: 'progress', id: req.id, update } satisfies WorkerMessage)
      }
    })
    port.postMessage({ type: 'result', id: req.id, result } satisfies WorkerMessage)
  } catch (err) {
    port.postMessage({
      type: 'error',
      id: req.id,
      message: err instanceof Error ? err.message : String(err)
    } satisfies WorkerMessage)
  }
})
