import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createUpdateNotices } from './notices'

// 제품 계약의 확인 주기다. 구현 상수를 가져오지 않아 주기가 바뀌면 테스트가 실패한다.
const SIX_HOURS_MS = 6 * 60 * 60 * 1000

function atomFeed(...tags: string[]): string {
  const entries = tags.map(
    (tag) =>
      `<entry><link rel="alternate" type="text/html" href="https://github.com/blahaj94/dfragon/releases/tag/${tag}"/></entry>`
  )

  return `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">${entries.join('')}</feed>`
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })

  return { promise, resolve, reject }
}

// 확인 결과의 Promise 연쇄가 끝나도록 대기한다. 주기 timer는 진행하지 않는다.
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

it('시작하면 바로 확인하고 새 버전을 구독과 조회에 같은 상태로 알린다', async () => {
  const readFeed = vi.fn(async (_signal: AbortSignal) => atomFeed('v0.0.3', 'v0.0.2'))
  const onFailure = vi.fn()
  const notices = createUpdateNotices({ currentVersion: '0.0.2', readFeed, onFailure })
  const listener = vi.fn()
  notices.subscribe(listener)

  notices.start()
  await settle()

  const expected = { revision: 1, notice: { tag: 'v0.0.3', endsOcrCollection: false } }
  expect(listener).toHaveBeenCalledExactlyOnceWith(expected)
  expect(notices.snapshot()).toEqual(expected)
  expect(readFeed).toHaveBeenCalledOnce()
  expect(onFailure).not.toHaveBeenCalled()
  notices.dispose()
})

it('첫 확인 뒤 6시간이 지나야 다시 확인한다', async () => {
  const readFeed = vi.fn(async (_signal: AbortSignal) => atomFeed())
  const notices = createUpdateNotices({ currentVersion: '0.0.2', readFeed, onFailure: vi.fn() })

  notices.start()
  await vi.advanceTimersByTimeAsync(SIX_HOURS_MS - 1)
  expect(readFeed).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1)
  expect(readFeed).toHaveBeenCalledTimes(2)
  notices.dispose()
})

it('확인 실패는 진단 코드만 남기고 이전 알림을 유지한 채 다음 주기에 다시 확인한다', async () => {
  const readFeed = vi
    .fn<(signal: AbortSignal) => Promise<string>>()
    .mockRejectedValueOnce(new Error('synthetic network failure'))
    .mockResolvedValueOnce(atomFeed('v0.0.3'))
    .mockResolvedValueOnce('<!DOCTYPE html><html></html>')
  const onFailure = vi.fn()
  const notices = createUpdateNotices({ currentVersion: '0.0.2', readFeed, onFailure })

  notices.start()
  await settle()
  expect(onFailure).toHaveBeenCalledExactlyOnceWith('UPDATE_CHECK_FAILED')
  expect(notices.snapshot().notice).toBeNull()

  await vi.advanceTimersByTimeAsync(SIX_HOURS_MS)
  expect(notices.snapshot().notice?.tag).toBe('v0.0.3')

  await vi.advanceTimersByTimeAsync(SIX_HOURS_MS)
  expect(onFailure).toHaveBeenCalledTimes(2)
  expect(notices.snapshot().notice?.tag).toBe('v0.0.3')
  expect(readFeed).toHaveBeenCalledTimes(3)
  notices.dispose()
})

it('닫은 버전은 다시 확인해도 알리지 않고 더 높은 버전은 다시 알린다', async () => {
  const readFeed = vi
    .fn<(signal: AbortSignal) => Promise<string>>()
    .mockResolvedValueOnce(atomFeed('v0.0.3'))
    .mockResolvedValueOnce(atomFeed('v0.0.3'))
    .mockResolvedValueOnce(atomFeed('v0.0.4', 'v0.0.3'))
  const notices = createUpdateNotices({ currentVersion: '0.0.2', readFeed, onFailure: vi.fn() })
  const listener = vi.fn()
  notices.subscribe(listener)
  notices.start()
  await settle()

  expect(notices.dismiss('v0.0.2')).toEqual({
    revision: 1,
    notice: { tag: 'v0.0.3', endsOcrCollection: false }
  })
  expect(notices.dismiss('v0.0.3')).toEqual({ revision: 2, notice: null })
  expect(listener).toHaveBeenLastCalledWith({ revision: 2, notice: null })

  await vi.advanceTimersByTimeAsync(SIX_HOURS_MS)
  expect(notices.snapshot()).toEqual({ revision: 2, notice: null })

  await vi.advanceTimersByTimeAsync(SIX_HOURS_MS)
  expect(notices.snapshot()).toEqual({
    revision: 3,
    notice: { tag: 'v0.0.4', endsOcrCollection: false }
  })
  notices.dispose()
})

it.each(['결과', '실패'] as const)(
  '진행 중인 확인은 겹쳐 시작하지 않고 dispose 뒤 늦게 온 %s를 버린다',
  async (outcome) => {
    const pending = deferred<string>()
    const signals: AbortSignal[] = []
    const readFeed = vi.fn((signal: AbortSignal) => {
      signals.push(signal)

      return pending.promise
    })
    const onFailure = vi.fn()
    const notices = createUpdateNotices({ currentVersion: '0.0.2', readFeed, onFailure })
    const listener = vi.fn()
    notices.subscribe(listener)

    notices.start()
    await vi.advanceTimersByTimeAsync(SIX_HOURS_MS)
    expect(readFeed).toHaveBeenCalledOnce()

    notices.dispose()
    expect(signals[0].aborted).toBe(true)
    if (outcome === '결과') {
      pending.resolve(atomFeed('v0.0.3'))
    } else {
      pending.reject(new Error('synthetic aborted request'))
    }
    await vi.advanceTimersByTimeAsync(SIX_HOURS_MS)

    expect(listener).not.toHaveBeenCalled()
    expect(notices.snapshot()).toEqual({ revision: 0, notice: null })
    expect(onFailure).not.toHaveBeenCalled()
    expect(readFeed).toHaveBeenCalledOnce()
  }
)

it('시작하지 않으면 확인하지 않는다', async () => {
  const readFeed = vi.fn(async (_signal: AbortSignal) => atomFeed('v0.0.3'))
  const notices = createUpdateNotices({ currentVersion: '0.0.2', readFeed, onFailure: vi.fn() })

  await vi.advanceTimersByTimeAsync(SIX_HOURS_MS * 2)

  expect(readFeed).not.toHaveBeenCalled()
  expect(notices.snapshot()).toEqual({ revision: 0, notice: null })
  notices.dispose()
})
