import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CompletedCache } from './completed-cache'

function createCache(options: { maximumEntries?: number; maximumBytes?: number; ttlMs?: number }) {
  return new CompletedCache<string>({
    maximumEntries: 3,
    maximumBytes: 100,
    ttlMs: 1_000,
    ...options
  })
}

describe('완료값 캐시', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('항목 수가 넘으면 가장 오래 쓰지 않은 항목부터 버린다', () => {
    const cache = createCache({ maximumEntries: 2 })
    cache.write('a', 'A', 1)
    cache.write('b', 'B', 1)
    cache.read('a')
    cache.write('c', 'C', 1)

    expect(cache.read('a')).toBe('A')
    expect(cache.read('b')).toBeUndefined()
    expect(cache.read('c')).toBe('C')
  })

  it('바이트 합이 상한을 넘으면 오래된 항목을 버리고 상한보다 큰 값은 저장하지 않는다', () => {
    const cache = createCache({ maximumBytes: 10 })
    cache.write('a', 'A', 6)
    cache.write('b', 'B', 6)
    cache.write('huge', 'H', 11)

    expect(cache.read('a')).toBeUndefined()
    expect(cache.read('b')).toBe('B')
    expect(cache.read('huge')).toBeUndefined()
    cache.write('c', 'C', 4)
    expect(cache.read('b')).toBe('B')
    expect(cache.read('c')).toBe('C')
  })

  it('같은 키를 다시 쓰면 이전 바이트를 상한 계산에서 뺀다', () => {
    const cache = createCache({ maximumBytes: 10 })
    cache.write('a', 'A1', 8)
    cache.write('a', 'A2', 8)
    cache.write('b', 'B', 2)

    expect(cache.read('a')).toBe('A2')
    expect(cache.read('b')).toBe('B')
  })

  it('TTL이 지난 항목은 읽을 수 없다', () => {
    const cache = createCache({ ttlMs: 1_000 })
    cache.write('a', 'A', 1)

    vi.advanceTimersByTime(999)
    expect(cache.read('a')).toBe('A')
    vi.advanceTimersByTime(1)
    expect(cache.read('a')).toBeUndefined()
  })
})
