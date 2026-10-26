import { performance } from 'node:perf_hooks'

/** 검색 마감과 Retry-After 대기가 쓰는 시계. 벽시계 변경과 무관한 단조 시간과 timer만 제공한다. */
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
