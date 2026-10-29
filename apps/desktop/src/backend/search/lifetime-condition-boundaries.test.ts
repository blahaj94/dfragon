import { expect, it, vi } from 'vitest'
import { createCaptureSearchLifetime, type CaptureBinding } from './capture-lifetime'
import { deferred } from '../lib/async-test-fixture'
import { FakeMonotonicClock } from '../lib/fake-monotonic-clock'
import { SearchHttpFailure } from './http'
import type { SearchRuntime } from './request'
import type { CharacterCandidatesHttp } from './character-http'
import { INITIAL_PORTRAIT_COLOR_POLICY } from './portrait-policy'
import type { CharacterCandidate } from '../../preload/common/types/character'
import type { OcrSearchObservation, SearchSnapshot } from '../../preload/common/types/search'

vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }))

const rows: readonly CharacterCandidate[] = [
  {
    characterId: 'synthetic-character',
    characterName: '가나',
    serverId: 'cain',
    serverName: '카인',
    fame: 0,
    imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1',
    adventureName: null,
    jobName: null,
    jobGrowName: null
  }
]

function binding(): Omit<CaptureBinding, 'captureId'> {
  return { windowGeneration: 2, sourceGeneration: 3 }
}

function runtime(candidates: CharacterCandidatesHttp, clock: FakeMonotonicClock): SearchRuntime {
  return {
    clock,
    identification: {
      candidates,
      image: vi.fn(),
      details: vi.fn(),
      scorePortrait: vi.fn(),
      selection: INITIAL_PORTRAIT_COLOR_POLICY
    },
    score: () => null
  }
}

function ocr(input: {
  captureId: string
  slot: number
  observationRevision: number
  nickname: string
}): OcrSearchObservation {
  return { ...input, candidateNicknames: [input.nickname], portrait: null }
}

async function flushCompletion(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve))
}

it('검색 불가 닉네임의 새 관측은 이전 HTTP와 deadline을 취소하고 입력 실패로 교체한다', async () => {
  const response = deferred<readonly CharacterCandidate[]>()
  const clock = new FakeMonotonicClock()
  const http = vi.fn<CharacterCandidatesHttp>().mockReturnValue(response.promise)
  const publish = vi.fn<(snapshot: SearchSnapshot) => void>()
  const lifetime = createCaptureSearchLifetime({
    publish,
    isCurrent: () => true,
    runtime: runtime(http, clock)
  })
  const captureId = lifetime.begin(binding()).snapshot.captureId!
  const pending = lifetime.observeOcr(
    ocr({ captureId, slot: 0, observationRevision: 1, nickname: '가나' })
  )
  await vi.waitFor(() => expect(http).toHaveBeenCalledTimes(1))
  const previousSignal = http.mock.calls[0][0].signal
  expect(previousSignal.aborted).toBe(false)

  const result = lifetime.observeOcr(
    ocr({ captureId, slot: 0, observationRevision: 2, nickname: '' })
  )
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
  const firstResponse = deferred<readonly CharacterCandidate[]>()
  const thirdResponse = deferred<readonly CharacterCandidate[]>()
  const clock = new FakeMonotonicClock()
  const http = vi
    .fn<CharacterCandidatesHttp>()
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
    runtime: runtime(http, clock)
  })
  const oldCaptureId = lifetime.begin(binding()).snapshot.captureId!
  for (const slot of [0, 1, 2]) {
    lifetime.observeOcr(
      ocr({ captureId: oldCaptureId, slot, observationRevision: 1, nickname: '가나' })
    )
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
  lifetime.observeOcr(
    ocr({ captureId: newCaptureId, slot: 0, observationRevision: 1, nickname: '다라' })
  )
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

it('pending 발행 중 새 관측이 요청을 대체하면 이전 요청의 HTTP나 deadline을 시작하지 않는다', async () => {
  const clock = new FakeMonotonicClock()
  const http = vi.fn<CharacterCandidatesHttp>().mockResolvedValue([])
  const lifetime = createCaptureSearchLifetime({
    runtime: runtime(http, clock),
    isCurrent: () => true,
    publish: (snapshot) => {
      if (snapshot.slots[0].state === 'pending') {
        lifetime.observeOcr(
          ocr({ captureId: snapshot.captureId!, slot: 0, observationRevision: 2, nickname: '' })
        )
      }
    }
  })
  const captureId = lifetime.begin(binding()).snapshot.captureId!

  const result = lifetime.observeOcr(
    ocr({ captureId, slot: 0, observationRevision: 1, nickname: '가나' })
  )

  expect(result.snapshot.slots[0]).toEqual({
    slot: 0,
    observationRevision: 2,
    requestId: expect.any(String),
    nickname: '',
    state: 'failure',
    rows: [],
    error: { code: 'INVALID_SEARCH_QUERY', retryAfterSeconds: null }
  })
  await flushCompletion()
  expect(http).not.toHaveBeenCalled()
  expect(clock.scheduled).toHaveLength(0)
  lifetime.end(captureId)
})

it('한 검색 수명의 종료는 다른 수명의 HTTP, deadline, 결과를 건드리지 않는다', async () => {
  const firstResponse = deferred<readonly CharacterCandidate[]>()
  const secondResponse = deferred<readonly CharacterCandidate[]>()
  const firstHttp = vi.fn<CharacterCandidatesHttp>().mockReturnValue(firstResponse.promise)
  const secondHttp = vi.fn<CharacterCandidatesHttp>().mockReturnValue(secondResponse.promise)
  const firstClock = new FakeMonotonicClock()
  const secondClock = new FakeMonotonicClock()
  const first = createCaptureSearchLifetime({
    runtime: runtime(firstHttp, firstClock),
    isCurrent: () => true,
    publish: vi.fn()
  })
  const second = createCaptureSearchLifetime({
    runtime: runtime(secondHttp, secondClock),
    isCurrent: () => true,
    publish: vi.fn()
  })
  const firstId = first.begin(binding()).snapshot.captureId!
  const secondId = second.begin(binding()).snapshot.captureId!
  first.observeOcr(ocr({ captureId: firstId, slot: 0, observationRevision: 1, nickname: '가나' }))
  second.observeOcr(ocr({ captureId: secondId, slot: 0, observationRevision: 1, nickname: '다라' }))
  await vi.waitFor(() => expect(secondHttp).toHaveBeenCalledTimes(1))
  expect(firstHttp).toHaveBeenCalledTimes(1)
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
    const response = deferred<readonly CharacterCandidate[]>()
    const http = vi.fn<CharacterCandidatesHttp>().mockReturnValue(response.promise)
    const publish = vi.fn<(snapshot: SearchSnapshot) => void>()
    let current = true
    const lifetime = createCaptureSearchLifetime({
      runtime: runtime(http, new FakeMonotonicClock()),
      isCurrent: () => current,
      publish
    })
    const captureId = lifetime.begin(binding()).snapshot.captureId!
    const pending = lifetime.observeOcr(
      ocr({ captureId, slot: 0, observationRevision: 1, nickname: '가나' })
    ).snapshot
    await vi.waitFor(() => expect(http).toHaveBeenCalledTimes(1))
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
