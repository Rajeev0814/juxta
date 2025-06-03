import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import type { BrowserWindow } from 'electron'
import { IPC } from '../shared/ipc'
import type { CompareOptions, CompareResult, ProgressUpdate } from '../shared/types'
import type { WorkerMessage, WorkerRequest } from './worker/compareWorker'

export const CANCELLED_MESSAGE = 'Comparison cancelled'

/** Minimal surface of a worker thread, so tests can inject a fake. */
export interface WorkerLike {
  on(event: 'message' | 'error' | 'exit', listener: (...args: any[]) => void): unknown
  postMessage(value: unknown): void
  terminate(): unknown
}

/**
 * Owns the comparison worker thread and bridges its messages to a renderer
 * window. The worker keeps directory walking + hashing off the main/UI thread.
 * Cancellation terminates the worker (rejecting the in-flight request); a fresh
 * worker is lazily recreated on the next compare.
 */
export class CompareService {
  private worker: WorkerLike | null = null
  private nextId = 1
  private pending = new Map<
    number,
    { resolve: (r: CompareResult) => void; reject: (e: Error) => void }
  >()

  constructor(
    private getWindow: () => BrowserWindow | null,
    // compareWorker.js is emitted alongside index.js (see electron.vite.config.ts).
    private createWorker: () => WorkerLike = () => new Worker(join(__dirname, 'compareWorker.js'))
  ) {}

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker
    const worker = this.createWorker()

    worker.on('message', (msg: WorkerMessage) => {
      if (msg.type === 'progress') {
        this.getWindow()?.webContents.send(IPC.compareProgress, msg.update as ProgressUpdate)
        return
      }
      const entry = this.pending.get(msg.id)
      if (!entry) return
      this.pending.delete(msg.id)
      if (msg.type === 'result') entry.resolve(msg.result)
      else entry.reject(new Error(msg.message))
    })

    worker.on('error', (err: Error) => {
      this.rejectAll(err)
      this.worker = null
    })

    worker.on('exit', () => {
      // Any requests still pending when the worker exits never completed.
      this.rejectAll(new Error('Comparison worker stopped'))
      this.worker = null
    })

    this.worker = worker
    return worker
  }

  private rejectAll(err: Error): void {
    for (const { reject } of this.pending.values()) reject(err)
    this.pending.clear()
  }

  compare(leftRoot: string, rightRoot: string, options: CompareOptions): Promise<CompareResult> {
    const worker = this.ensureWorker()
    const id = this.nextId++
    return new Promise<CompareResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const req: WorkerRequest = { id, leftRoot, rightRoot, options }
      worker.postMessage(req)
    })
  }

  /** Cancel the in-flight comparison by tearing down the worker. */
  cancel(): void {
    this.rejectAll(new Error(CANCELLED_MESSAGE))
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
  }
}
