import { performance } from 'node:perf_hooks'

export interface MonotonicClock {
  read(): Readonly<{ monotonicMs: number }>
  schedule(delayMs: number, callback: () => void): () => void
}

export function createMonotonicClock(): MonotonicClock {
  return {
    read: () => ({ monotonicMs: performance.now() }),
    schedule: (delayMs, callback) => {
      const timeout = setTimeout(callback, delayMs)

      return () => clearTimeout(timeout)
    }
  }
}
