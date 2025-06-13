import { describe, expect, it } from 'vitest'
import { CompareService, CANCELLED_MESSAGE, type WorkerLike } from '../src/main/compareService'
import { DEFAULT_OPTIONS, type CompareResult } from '../src/shared/types'

// A fake worker that lets the test drive the message protocol synchronously.
class FakeWorker implements WorkerLike {
  private listeners: Record<string, Array<(arg: unknown) => void>> = {}
  posted: unknown[] = []
  terminated = false
  on(event: string, listener: (...args: any[]) => void): void {
    ;(this.listeners[event] ||= []).push(listener)
  }
  postMessage(value: unknown): void {
    this.posted.push(value)
  }
  terminate(): void {
    this.terminated = true
  }
  emit(event: string, arg: unknown): void {
    ;(this.listeners[event] || []).forEach((l) => l(arg))
  }
}

const fakeResult = (): CompareResult => ({
  leftRoot: 'l',
  rightRoot: 'r',
  options: DEFAULT_OPTIONS,
  root: { name: '', relPath: '', kind: 'directory', status: 'identical', children: [] },
  summary: { identical: 0, different: 0, leftOnly: 0, rightOnly: 0, moved: 0, totalFiles: 0 },
  moves: [],
  elapsedMs: 1
})

describe('CompareService', () => {
  it('posts a request and resolves on the matching result message', async () => {
    const fake = new FakeWorker()
    const svc = new CompareService(() => null, () => fake)
    const p = svc.compare('l', 'r', DEFAULT_OPTIONS)
    expect(fake.posted).toHaveLength(1)
    const req = fake.posted[0] as { id: number }
    const result = fakeResult()
    fake.emit('message', { type: 'result', id: req.id, result })
    await expect(p).resolves.toEqual(result)
  })

  it('rejects with the worker error message on an error message', async () => {
    const fake = new FakeWorker()
    const svc = new CompareService(() => null, () => fake)
    const p = svc.compare('l', 'r', DEFAULT_OPTIONS)
    const req = fake.posted[0] as { id: number }
    fake.emit('message', { type: 'error', id: req.id, message: 'boom' })
    await expect(p).rejects.toThrow('boom')
  })

  it('cancel() rejects the in-flight request and terminates the worker', async () => {
    const fake = new FakeWorker()
    const svc = new CompareService(() => null, () => fake)
    const p = svc.compare('l', 'r', DEFAULT_OPTIONS)
    svc.cancel()
    await expect(p).rejects.toThrow(CANCELLED_MESSAGE)
    expect(fake.terminated).toBe(true)
  })

  it('recreates the worker after a cancellation', async () => {
    let created = 0
    const svc = new CompareService(() => null, () => {
      created++
      return new FakeWorker()
    })
    svc.compare('l', 'r', DEFAULT_OPTIONS).catch(() => {})
    svc.cancel()
    svc.compare('l', 'r', DEFAULT_OPTIONS).catch(() => {})
    expect(created).toBe(2)
  })
})
