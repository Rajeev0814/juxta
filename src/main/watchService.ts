import { watch, type FSWatcher } from 'node:fs'
import { createDebouncer, type Debouncer } from '../shared/debounce'

/**
 * Watches one or more folder roots and invokes a debounced callback on any
 * change beneath them, so the renderer can live-re-compare.
 */
export class FolderWatcher {
  private watchers: FSWatcher[] = []
  private debouncer: Debouncer

  constructor(onChange: () => void, delayMs = 600) {
    this.debouncer = createDebouncer(onChange, delayMs)
  }

  watch(paths: string[]): void {
    this.close()
    for (const p of paths) {
      if (!p) continue
      try {
        const w = watch(p, { recursive: true }, () => this.debouncer.trigger())
        w.on('error', () => {}) // ignore watch errors (e.g. path removed)
        this.watchers.push(w)
      } catch {
        // unwatchable path — skip
      }
    }
  }

  close(): void {
    this.debouncer.cancel()
    for (const w of this.watchers) {
      try {
        w.close()
      } catch {
        // already closed
      }
    }
    this.watchers = []
  }
}
