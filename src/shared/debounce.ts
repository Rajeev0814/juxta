export interface Debouncer {
  /** Schedule the function; repeated triggers within the delay collapse to one. */
  trigger(): void
  cancel(): void
}

export function createDebouncer(fn: () => void, delayMs: number): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    trigger() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        fn()
      }, delayMs)
    },
    cancel() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
  }
}
