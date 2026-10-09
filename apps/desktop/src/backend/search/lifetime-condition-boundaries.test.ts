import { expect, it, vi } from 'vitest'
import { createCaptureSearchLifetime, type CaptureBinding } from './capture-lifetime'
import { deferred, FakeClock } from '../auth/auth-test-fixtures'
import { SearchHttpFailure } from './http'
import type { SearchRuntime } from './request'
import type { CharacterSearchRow, SearchSnapshot } from '../../preload/common/types/search'

const rows: readonly CharacterSearchRow[] = [
  {
    characterId: 'synthetic-character',
    characterName: '가나',
    serverId: 'cain',
    serverName: '카인',
    fame: 0
  }
]

function binding(): Omit<CaptureBinding, 'captureId'> {
  return { windowGeneration: 2, sourceGeneration: 3 }
}

async function flushCompletion(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve))
}

it('검색 불가 닉네임의 새 관측은 이전 HTTP와 deadline을 취소하고 입력 실패로 교체한다', async () => {
  const response = deferred<readonly CharacterSearchRow[]>()
  const clock = new FakeClock()
  const http = vi.fn<SearchRuntime['http']>().mockReturnValue(response.promise)
  const publish = vi.fn<(snapshot: SearchSnapshot) => void>()
  const lifetime = createCaptureSearchLifetime({
    publish,
    isCurrent: () => true,
    runtime: { http, clock }
  })
  const captureId = lifetime.begin(binding()).snapshot.captureId!
  const pending = lifetime.observe({ captureId, slot: 0, observationRevision: 1, nickname: '가나' })
  const previousSignal = http.mock.calls[0][0].signal
  expect(previousSignal.aborted).toBe(false)

  const result = lifetime.observe({ captureId, slot: 0, observationRevision: 2, nickname: '' })
  await flushCompletion()

  expect(result.snapshot.slots[0]).toEqual({
    slot: 0,
    observationRevision: 2,
    requestId: expect.any(String),
    nickname: '',
    state: 'failure',
    rows: [],
    error: { code: 'INVALID_SEARCH_QUERY', retryAfterSeconds: null }
  })
  expect(result.snapshot.slots[0].requestId).not.toBe(pending.snapshot.slots[0].requestId)
  expect(previousSignal.aborted).toBe(true)
  expect(http).toHaveBeenCalledTimes(1)
  expect(clock.scheduled.every((task) => task.cancelled)).toBe(true)
  publish.mockClear()

  response.resolve(rows)
  await flushCompletion()
  expect(lifetime.snapshot()).toEqual(result.snapshot)
  expect(publish).not.toHaveBeenCalled()
  lifetime.end(captureId)
})

it('Stop은 모든 슬롯의 HTTP와 429 대기를 정리하고 새 수명을 늦은 완료, 종료로부터 보호한다', async () => {
  const firstResponse = deferred<readonly CharacterSearchRow[]>()
  const thirdResponse = deferred<readonly CharacterSearchRow[]>()
  const clock = new FakeClock()
  const http = vi
    .fn<SearchRuntime['http']>()
    .mockReturnValueOnce(firstResponse.promise)
    .mockRejectedValueOnce(
      new SearchHttpFailure('SEARCH_RATE_LIMITED', {
        retryAfterSeconds: 2,
        retryAfterReceivedAt: clock.monotonicMs
      })
    )
    .mockReturnValueOnce(thirdResponse.promise)
    .mockResolvedValueOnce([])
  const publish = vi.fn<(snapshot: SearchSnapshot) => void>()
  const lifetime = createCaptureSearchLifetime({
    publish,
    isCurrent: () => true,
    runtime: { http, clock }
  })
  const oldCaptureId = lifetime.begin(binding()).snapshot.captureId!
  for (const slot of [0, 1, 2]) {
    lifetime.observe({ captureId: oldCaptureId, slot, observationRevision: 1, nickname: '가나' })
  }
  await vi.waitFor(() =>
    expect(lifetime.snapshot().slots[1]).toMatchObject({
      state: 'failure',
      error: { code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 2 }
    })
  )
  const before = lifetime.snapshot()
  const requests = http.mock.calls.map(([input]) => input)
  expect([requests[0].signal.aborted, requests[2].signal.aborted]).toEqual([false, false])
  publish.mockClear()

  const ended = lifetime.end(oldCaptureId)
  await flushCompletion()

  expect(ended.snapshot).toEqual({
    runId: before.runId,
    revision: before.revision + 1,
    captureId: null,
    slots: [0, 1, 2, 3].map((slot) => ({
      slot,
      observationRevision: 0,
      requestId: null,
      nickname: null,
      state: 'idle',
      rows: [],
      error: null
    }))
  })
  expect([requests[0].signal.aborted, requests[2].signal.aborted]).toEqual([true, true])
  expect(clock.scheduled.every((task) => task.cancelled)).toBe(true)
  expect(publish).toHaveBeenCalledExactlyOnceWith(ended.snapshot)
  clock.advance(20_000)
  await flushCompletion()
  expect(lifetime.snapshot()).toEqual(ended.snapshot)
  expect(http).toHaveBeenCalledTimes(3)

  const newCaptureId = lifetime.begin(binding()).snapshot.captureId!
  expect(newCaptureId).not.toBe(oldCaptureId)
  lifetime.observe({ captureId: newCaptureId, slot: 0, observationRevision: 1, nickname: '다라' })
  await vi.waitFor(() => expect(lifetime.snapshot().slots[0].state).toBe('empty'))
  const current = lifetime.snapshot()
  publish.mockClear()

  firstResponse.resolve(rows)
  thirdResponse.reject(new Error('Synthetic late transport failure'))
  await flushCompletion()
  expect(lifetime.end(oldCaptureId)).toEqual({ ok: true, snapshot: current })
  expect(lifetime.snapshot()).toEqual(current)
  expect(publish).not.toHaveBeenCalled()
  expect(http).toHaveBeenCalledTimes(4)
  lifetime.end(newCaptureId)
})

it('pending 발행 중 clear가 발생하면 HTTP나 deadline을 시작하지 않는다', () => {
  const clock = new FakeClock()
  const http = vi.fn<SearchRuntime['http']>().mockResolvedValue([])
  const lifetime = createCaptureSearchLifetime({
    runtime: { http, clock },
    isCurrent: () => true,
    publish: (snapshot) => {
      if (snapshot.slots[0].state === 'pending') {
        lifetime.clear({
          action: 'clear',
          captureId: snapshot.captureId!,
          slot: 0,
          observationRevision: 2
        })
      }
    }
  })
  const captureId = lifetime.begin(binding()).snapshot.captureId!

  const result = lifetime.observe({ captureId, slot: 0, observationRevision: 1, nickname: '가나' })

  expect(result.snapshot.slots[0]).toEqual({
    slot: 0,
    observationRevision: 2,
    requestId: null,
    nickname: null,
    state: 'idle',
    rows: [],
    error: null
  })
  expect(http).not.toHaveBeenCalled()
  expect(clock.scheduled).toHaveLength(0)
  lifetime.end(captureId)
})

it('한 검색 수명의 종료는 다른 수명의 HTTP, deadline, 결과를 건드리지 않는다', async () => {
  const firstResponse = deferred<readonly CharacterSearchRow[]>()
  const secondResponse = deferred<readonly CharacterSearchRow[]>()
  const firstHttp = vi.fn<SearchRuntime['http']>().mockReturnValue(firstResponse.promise)
  const secondHttp = vi.fn<SearchRuntime['http']>().mockReturnValue(secondResponse.promise)
  const firstClock = new FakeClock()
  const secondClock = new FakeClock()
  const first = createCaptureSearchLifetime({
    runtime: { http: firstHttp, clock: firstClock },
    isCurrent: () => true,
    publish: vi.fn()
  })
  const second = createCaptureSearchLifetime({
    runtime: { http: secondHttp, clock: secondClock },
    isCurrent: () => true,
    publish: vi.fn()
  })
  const firstId = first.begin(binding()).snapshot.captureId!
  const secondId = second.begin(binding()).snapshot.captureId!
  first.observe({ captureId: firstId, slot: 0, observationRevision: 1, nickname: '가나' })
  second.observe({ captureId: secondId, slot: 0, observationRevision: 1, nickname: '다라' })
  const secondPending = second.snapshot()

  first.end(firstId)
  firstResponse.resolve(rows)
  await flushCompletion()

  expect(first.snapshot().captureId).toBeNull()
  expect(firstHttp.mock.calls[0][0].signal.aborted).toBe(true)
  expect(firstClock.scheduled.every((task) => task.cancelled)).toBe(true)
  expect(secondHttp.mock.calls[0][0].signal.aborted).toBe(false)
  expect(secondClock.scheduled.some((task) => !task.cancelled)).toBe(true)
  expect(second.snapshot()).toEqual(secondPending)
  secondResponse.resolve([])
  await vi.waitFor(() =>
    expect(second.snapshot().slots[0]).toEqual({
      ...secondPending.slots[0],
      state: 'empty'
    })
  )
  expect(first.snapshot().slots.every((slot) => slot.state === 'idle')).toBe(true)
  second.end(secondId)
})

it.each(['성공', '실패'])(
  '현재 binding을 확인할 수 없는 늦은 %s는 상태를 발행하지 않는다',
  async (outcome) => {
    const response = deferred<readonly CharacterSearchRow[]>()
    const http = vi.fn<SearchRuntime['http']>().mockReturnValue(response.promise)
    const publish = vi.fn<(snapshot: SearchSnapshot) => void>()
    let current = true
    const lifetime = createCaptureSearchLifetime({
      runtime: { http, clock: new FakeClock() },
      isCurrent: () => current,
      publish
    })
    const captureId = lifetime.begin(binding()).snapshot.captureId!
    const pending = lifetime.observe({
      captureId,
      slot: 0,
      observationRevision: 1,
      nickname: '가나'
    }).snapshot
    publish.mockClear()
    current = false

    if (outcome === '성공') {
      response.resolve(rows)
    } else {
      response.reject(new Error('Synthetic transport failure'))
    }
    await flushCompletion()

    expect(lifetime.snapshot()).toEqual(pending)
    expect(publish).not.toHaveBeenCalled()
    lifetime.invalidate()
  }
)
