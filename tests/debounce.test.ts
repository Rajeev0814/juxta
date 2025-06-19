import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncer } from '../src/shared/debounce'

describe('createDebouncer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('collapses rapid triggers into a single call after the delay', () => {
    let calls = 0
    const d = createDebouncer(() => calls++, 500)
    d.trigger()
    d.trigger()
    d.trigger()
    vi.advanceTimersByTime(499)
    expect(calls).toBe(0)
    vi.advanceTimersByTime(1)
    expect(calls).toBe(1)
  })

  it('fires again for a fresh trigger', () => {
    let calls = 0
    const d = createDebouncer(() => calls++, 100)
    d.trigger()
    vi.advanceTimersByTime(100)
    d.trigger()
    vi.advanceTimersByTime(100)
    expect(calls).toBe(2)
  })

  it('cancel prevents a pending call', () => {
    let calls = 0
    const d = createDebouncer(() => calls++, 100)
    d.trigger()
    d.cancel()
    vi.advanceTimersByTime(200)
    expect(calls).toBe(0)
  })
})
