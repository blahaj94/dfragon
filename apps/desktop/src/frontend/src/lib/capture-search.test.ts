import { afterEach, expect, it, vi, type Mock } from 'vitest'
import type {
  OcrSearchObservation,
  SearchApi,
  SearchCommandResult,
  SearchSnapshot,
  SearchObservation
} from '../../../preload/common/types/search'
import type { CharacterPortrait } from '../../../preload/common/types/character'
import {
  CAPTURE_ID,
  REQUEST_ID,
  searchRow,
  searchSlot,
  searchSnapshot
} from '../../../preload/api/search-test-fixture'
import type { SearchView } from '../types/search'
import { createCaptureSearch, type CaptureSearch } from './capture-search'

const searches: CaptureSearch[] = []
afterEach(() => searches.splice(0).forEach((search) => search.dispose()))

/** 실제 SearchConnection을 통과시키면서 main 응답, event 순서만 제어한다. */
async function fixture({ ocrSupported = true }: { ocrSupported?: boolean } = {}): Promise<{
  search: CaptureSearch
  control: Mock<SearchApi['controlCharacterSearch']>
  notify: Mock<(observation: SearchObservation) => Promise<SearchCommandResult>>
  notifyOcr: Mock<(observation: OcrSearchObservation) => Promise<SearchCommandResult>>
  changed: Mock<(view: SearchView) => void>
  invalidated: Mock
  emit: (snapshot: SearchSnapshot) => void
}> {
  let current = searchSnapshot({ captureId: null })
  let listener: (snapshot: SearchSnapshot) => void = () => {}
  const control = vi.fn<SearchApi['controlCharacterSearch']>(async () => ({
    ok: true,
    snapshot: current
  }))
  const notify = vi.fn<(observation: SearchObservation) => Promise<SearchCommandResult>>(
    async (): Promise<SearchCommandResult> => ({ ok: true, snapshot: current })
  )
  const notifyOcr = vi.fn<(observation: OcrSearchObservation) => Promise<SearchCommandResult>>(
    async (): Promise<SearchCommandResult> => ({ ok: true, snapshot: current })
  )
  const changed = vi.fn<(view: SearchView) => void>()
  const invalidated = vi.fn()
  const search = createCaptureSearch({
    api: {
      controlCharacterSearch: control,
      onCharacterSearchChanged: (next) => {
        listener = next

        return () => {}
      }
    },
    notify,
    notifyOcr: ocrSupported ? notifyOcr : undefined,
    onChange: changed,
    onInvalidated: invalidated
  })
  searches.push(search)
  search.connect()
  await vi.waitFor(() => expect(changed.mock.lastCall?.[0].ready).toBe(true))

  return {
    search,
    control,
    notify,
    notifyOcr,
    changed,
    invalidated,
    emit: (snapshot) => {
      current = snapshot
      listener(snapshot)
    }
  }
}

it('OCR 후보 순서와 얼굴을 현재 capture ID, 관측 revision과 함께 전용 통지로 전달한다', async () => {
  const f = await fixture()
  f.control.mockResolvedValueOnce({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })
  await f.search.begin({ signal: new AbortController().signal })
  const portrait: CharacterPortrait = {
    image: {
      width: 2,
      height: 1,
      rgba: new Uint8Array([12, 34, 56, 255, 78, 90, 12, 255])
    },
    rasterScale: 2,
    validMask: new Uint8Array([1, 0])
  }

  f.search.observe({
    slot: 2,
    nickname: '가나',
    candidateNicknames: ['가나', '가너'],
    portrait
  })
  f.search.observe({
    slot: 2,
    nickname: '다라',
    candidateNicknames: ['다라', '다러'],
    portrait: null
  })

  expect(f.notifyOcr.mock.calls).toEqual([
    [
      {
        captureId: CAPTURE_ID,
        slot: 2,
        observationRevision: 1,
        nickname: '가나',
        candidateNicknames: ['가나', '가너'],
        portrait
      }
    ],
    [
      {
        captureId: CAPTURE_ID,
        slot: 2,
        observationRevision: 2,
        nickname: '다라',
        candidateNicknames: ['다라', '다러'],
        portrait: null
      }
    ]
  ])
  expect(f.notify).not.toHaveBeenCalled()
})

it('얼굴 크롭이 없는 OCR 관측의 waiting-portrait 상태를 표시한다', async () => {
  const f = await fixture()
  f.control.mockResolvedValueOnce({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })
  await f.search.begin({ signal: new AbortController().signal })
  const waiting = searchSlot({ state: 'waiting-portrait' })
  f.notifyOcr.mockResolvedValueOnce({
    ok: true,
    snapshot: searchSnapshot({ revision: 3, slots: [waiting, ...searchSnapshot().slots.slice(1)] })
  })

  f.search.observe({
    slot: 0,
    nickname: '가나',
    candidateNicknames: ['가나', '가너'],
    portrait: null
  })

  await vi.waitFor(() => expect(f.changed.mock.lastCall?.[0].slots[0]).toEqual(waiting))
  expect(f.changed.mock.lastCall?.[0].connectionFailed).toBe(false)
  expect(f.changed.mock.lastCall?.[0].captureActive).toBe(true)
  expect(f.notify).not.toHaveBeenCalled()
})

it.each(['이름 변경', 'clear', 'end'] as const)(
  '%s 뒤 도착한 이전 OCR 결과는 슬롯에 다시 표시하지 않는다',
  async (action) => {
    const f = await fixture()
    f.control.mockResolvedValueOnce({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })
    await f.search.begin({ signal: new AbortController().signal })
    const response = Promise.withResolvers<SearchCommandResult>()
    f.notifyOcr.mockReturnValueOnce(response.promise)
    f.search.observe({
      slot: 0,
      nickname: '가나',
      candidateNicknames: ['가나', '가너'],
      portrait: null
    })
    const waiting = searchSlot({ state: 'waiting-portrait' })
    f.emit(searchSnapshot({ revision: 3, slots: [waiting, ...searchSnapshot().slots.slice(1)] }))
    expect(f.changed.mock.lastCall?.[0].slots[0]).toEqual(waiting)

    if (action === '이름 변경') {
      f.search.observe({
        slot: 0,
        nickname: '다라',
        candidateNicknames: ['다라', '다러'],
        portrait: null
      })
    } else if (action === 'clear') {
      f.search.observe({ slot: 0, nickname: null })
    } else {
      f.search.end()
    }

    expect(f.changed.mock.lastCall?.[0].slots[0].state).toBe('idle')
    const published = f.changed.mock.calls.length
    const staleSuccess = searchSlot({ state: 'success', rows: [searchRow] })
    response.resolve({
      ok: true,
      snapshot: searchSnapshot({
        revision: 4,
        slots: [staleSuccess, ...searchSnapshot().slots.slice(1)]
      })
    })

    await vi.waitFor(() => expect(f.changed.mock.calls.length).toBeGreaterThan(published))
    expect(f.changed.mock.lastCall?.[0].slots[0].state).toBe('idle')
    expect(f.notify).not.toHaveBeenCalled()
    if (action === 'end') {
      expect(f.changed.mock.lastCall?.[0].captureActive).toBe(false)
    }
  }
)

it('OCR 전용 통지를 지원하지 않으면 기존 결과를 숨기고 연결 실패를 표시한다', async () => {
  const f = await fixture({ ocrSupported: false })
  f.control.mockResolvedValueOnce({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })
  await f.search.begin({ signal: new AbortController().signal })
  f.search.observe({ slot: 0, nickname: '가나' })
  const previous = searchSlot({ state: 'success', rows: [searchRow] })
  f.emit(searchSnapshot({ revision: 3, slots: [previous, ...searchSnapshot().slots.slice(1)] }))
  expect(f.changed.mock.lastCall?.[0].slots[0]).toEqual(previous)
  f.notify.mockClear()

  expect(() =>
    f.search.observe({
      slot: 0,
      nickname: '다라',
      candidateNicknames: ['다라', '다러'],
      portrait: null
    })
  ).not.toThrow()

  expect(f.changed.mock.lastCall?.[0].slots[0].state).toBe('idle')
  expect(f.changed.mock.lastCall?.[0].connectionFailed).toBe(true)
  expect(f.changed.mock.lastCall?.[0].captureActive).toBe(true)
  expect(f.notify).not.toHaveBeenCalled()
  expect(f.notifyOcr).not.toHaveBeenCalled()
})

it('연속 begin의 이전 응답은 자신의 ID만 end하고 새 관측 revision을 초기화하지 않는다', async () => {
  const f = await fixture()
  const first = Promise.withResolvers<SearchCommandResult>()
  const second = Promise.withResolvers<SearchCommandResult>()
  f.control.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const oldStart = f.search.begin({ signal: new AbortController().signal })
  const newStart = f.search.begin({ signal: new AbortController().signal })
  const nextId = '00000000-0000-4000-8000-000000000099'
  const latest = searchSnapshot({ captureId: nextId, revision: 3 })
  f.emit(latest)
  second.resolve({ ok: true, snapshot: latest })
  expect(await newStart).toBe(nextId)
  f.search.observe({ slot: 0, nickname: '가나' })

  first.resolve({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })
  expect(await oldStart).toBeNull()
  f.search.observe({ slot: 0, nickname: '다라' })

  expect(f.notify).toHaveBeenLastCalledWith({
    captureId: nextId,
    slot: 0,
    observationRevision: 2,
    nickname: '다라'
  })
  expect(f.control.mock.calls.filter(([command]) => command.action === 'end')).toEqual([
    [{ action: 'end', captureId: CAPTURE_ID }]
  ])
  expect(f.changed.mock.lastCall?.[0].captureActive).toBe(true)
})

it('실행 중 end, dispose를 반복해도 소유 ID는 한 번만 end하고 폐기 뒤 begin은 보내지 않는다', async () => {
  const f = await fixture()
  const active = searchSnapshot({ revision: 2 })
  f.control.mockResolvedValueOnce({ ok: true, snapshot: active })
  expect(await f.search.begin({ signal: new AbortController().signal })).toBe(CAPTURE_ID)
  f.search.end()
  f.search.end()
  f.search.dispose()
  f.search.dispose()

  expect(await f.search.begin({ signal: new AbortController().signal })).toBeNull()
  expect(f.control.mock.calls.map(([command]) => command.action)).toEqual(['read', 'begin', 'end'])
  expect(f.changed.mock.lastCall?.[0].captureActive).toBe(false)
})

it('main이 끝낸 capture는 즉시 비활성화하고 END를 다시 보내지 않는다', async () => {
  const f = await fixture()
  f.control.mockResolvedValueOnce({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })
  await f.search.begin({ signal: new AbortController().signal })
  f.emit(searchSnapshot({ captureId: null, revision: 3 }))

  expect(f.invalidated).toHaveBeenCalledOnce()
  expect(f.changed.mock.lastCall?.[0].captureActive).toBe(false)
  f.search.observe({ slot: 0, nickname: '가나' })
  f.search.end()
  expect(f.notify).not.toHaveBeenCalled()
  expect(f.control.mock.calls.map(([command]) => command.action)).toEqual(['read', 'begin'])
})

it('run 변경 중 늦은 begin은 정리하고 재연결 뒤 새 begin은 사용할 수 있다', async () => {
  const f = await fixture()
  const delayed = Promise.withResolvers<SearchCommandResult>()
  f.control.mockReturnValueOnce(delayed.promise)
  const begin = f.search.begin({ signal: new AbortController().signal })
  const nextRun = '00000000-0000-4000-8000-000000000088'
  f.emit(searchSnapshot({ runId: nextRun, captureId: null, revision: 0 }))
  await vi.waitFor(() => expect(f.changed.mock.lastCall?.[0].ready).toBe(true))
  delayed.resolve({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })
  expect(await begin).toBeNull()
  expect(f.control).toHaveBeenCalledWith({ action: 'end', captureId: CAPTURE_ID })
  expect(f.invalidated).toHaveBeenCalledOnce()

  const nextId = '00000000-0000-4000-8000-000000000099'
  f.control.mockResolvedValueOnce({
    ok: true,
    snapshot: searchSnapshot({ runId: nextRun, captureId: nextId, revision: 1 })
  })
  expect(await f.search.begin({ signal: new AbortController().signal })).toBe(nextId)
  expect(f.changed.mock.lastCall?.[0].captureActive).toBe(true)
})

it('반환 함수를 분리해서 호출해도 각 검색의 관측 상태와 종료가 격리된다', async () => {
  const first = await fixture()
  const second = await fixture()
  const otherId = '00000000-0000-4000-8000-000000000099'
  first.control.mockResolvedValueOnce({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })
  second.control.mockResolvedValueOnce({
    ok: true,
    snapshot: searchSnapshot({ captureId: otherId, revision: 2 })
  })
  const { begin, observe, dispose } = first.search
  expect(await begin({ signal: new AbortController().signal })).toBe(CAPTURE_ID)
  expect(await second.search.begin({ signal: new AbortController().signal })).toBe(otherId)
  first.emit(searchSnapshot({ revision: 2 }))
  second.emit(searchSnapshot({ captureId: otherId, revision: 2 }))

  observe({ slot: 0, nickname: '가나' })
  observe({ slot: 0, nickname: '다라' })
  second.search.observe({ slot: 0, nickname: '마바' })
  expect(first.notify).toHaveBeenLastCalledWith({
    captureId: CAPTURE_ID,
    slot: 0,
    observationRevision: 2,
    nickname: '다라'
  })
  expect(second.notify).toHaveBeenLastCalledWith({
    captureId: otherId,
    slot: 0,
    observationRevision: 1,
    nickname: '마바'
  })

  dispose()
  expect(second.changed.mock.lastCall?.[0].captureActive).toBe(true)
  expect(second.control).not.toHaveBeenCalledWith({ action: 'end', captureId: otherId })
  second.search.observe({ slot: 0, nickname: '사아' })
  expect(second.notify).toHaveBeenLastCalledWith({
    captureId: otherId,
    slot: 0,
    observationRevision: 2,
    nickname: '사아'
  })
})

it('시작 응답 전에 취소한 호출은 늦은 ID를 한 번만 종료하고 관측을 제출하지 않는다', async () => {
  const f = await fixture()
  const pending = Promise.withResolvers<SearchCommandResult>()
  const controller = new AbortController()
  f.control.mockReturnValueOnce(pending.promise)
  const start = f.search.begin({ signal: controller.signal })
  controller.abort()
  pending.resolve({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })

  expect(await start).toBeNull()
  f.search.observe({ slot: 0, nickname: '가나' })
  f.search.end()
  f.search.dispose()

  expect(f.notify).not.toHaveBeenCalled()
  expect(f.control.mock.calls.map(([command]) => command)).toEqual([
    { action: 'read' },
    { action: 'begin' },
    { action: 'end', captureId: CAPTURE_ID }
  ])
  expect(f.changed.mock.lastCall?.[0].captureActive).toBe(false)
})

it('시작 응답이 유실되면 조회의 ID를 임의로 채택하거나 시작을 재전송하지 않는다', async () => {
  const f = await fixture()
  f.control
    .mockRejectedValueOnce(new Error('synthetic begin reply loss'))
    .mockResolvedValueOnce({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })

  expect(await f.search.begin({ signal: new AbortController().signal })).toBeNull()
  f.search.observe({ slot: 0, nickname: '가나' })

  expect(f.control.mock.calls.map(([command]) => command)).toEqual([
    { action: 'read' },
    { action: 'begin' },
    { action: 'read' }
  ])
  expect(f.notify).not.toHaveBeenCalled()
  expect(f.changed.mock.lastCall?.[0].captureActive).toBe(false)
  expect(f.changed.mock.lastCall?.[0].ready).toBe(true)
})

it('clear 응답을 기다려도 후보는 즉시 지우고 이전 관측 결과는 복원하지 않는다', async () => {
  const f = await fixture()
  f.control.mockResolvedValueOnce({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })
  await f.search.begin({ signal: new AbortController().signal })
  f.search.observe({ slot: 0, nickname: '가나' })
  const success = searchSlot({ state: 'success', rows: [searchRow] })
  f.emit(searchSnapshot({ revision: 3, slots: [success, ...searchSnapshot().slots.slice(1)] }))
  expect(f.changed.mock.lastCall?.[0].slots[0]).toEqual(success)
  const clear = Promise.withResolvers<SearchCommandResult>()
  f.control.mockReturnValueOnce(clear.promise)

  f.search.observe({ slot: 0, nickname: null })

  expect(f.changed.mock.lastCall?.[0].slots[0]).toEqual({
    slot: 0,
    observationRevision: 0,
    requestId: null,
    nickname: null,
    state: 'idle',
    rows: [],
    error: null
  })
  expect(f.control).toHaveBeenLastCalledWith({
    action: 'clear',
    captureId: CAPTURE_ID,
    slot: 0,
    observationRevision: 2
  })
  f.emit(searchSnapshot({ revision: 4, slots: [success, ...searchSnapshot().slots.slice(1)] }))
  expect(f.changed.mock.lastCall?.[0].slots[0].state).toBe('idle')
  const cleared = searchSlot({
    observationRevision: 2,
    state: 'idle',
    requestId: null,
    nickname: null
  })
  clear.resolve({
    ok: true,
    snapshot: searchSnapshot({ revision: 5, slots: [cleared, ...searchSnapshot().slots.slice(1)] })
  })
  await vi.waitFor(() => expect(f.changed.mock.lastCall?.[0].slots[0]).toEqual(cleared))
})

it('이전 이름의 retry 완료는 새 이름의 retry 대기를 해제하지 않는다', async () => {
  const f = await fixture()
  f.control.mockResolvedValueOnce({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })
  await f.search.begin({ signal: new AbortController().signal })
  f.search.observe({ slot: 0, nickname: '가나' })
  const firstFailure = searchSlot({
    state: 'failure',
    error: { code: 'SEARCH_TIMEOUT', retryAfterSeconds: null }
  })
  f.emit(searchSnapshot({ revision: 3, slots: [firstFailure, ...searchSnapshot().slots.slice(1)] }))
  const firstResponse = Promise.withResolvers<SearchCommandResult>()
  f.control.mockReturnValueOnce(firstResponse.promise)
  const firstRetry = f.search.retry(0)
  expect(f.changed.mock.lastCall?.[0].retryPending).toEqual([true, false, false, false])

  f.search.observe({ slot: 0, nickname: '다라' })
  const nextRequestId = '00000000-0000-4000-8000-000000000099'
  const nextFailure = searchSlot({
    state: 'failure',
    nickname: '다라',
    observationRevision: 2,
    requestId: nextRequestId,
    error: { code: 'SEARCH_NETWORK_ERROR', retryAfterSeconds: null }
  })
  f.emit(searchSnapshot({ revision: 5, slots: [nextFailure, ...searchSnapshot().slots.slice(1)] }))
  const nextResponse = Promise.withResolvers<SearchCommandResult>()
  f.control.mockReturnValueOnce(nextResponse.promise)
  const nextRetry = f.search.retry(0)

  firstResponse.resolve({
    ok: true,
    snapshot: searchSnapshot({
      revision: 4,
      slots: [firstFailure, ...searchSnapshot().slots.slice(1)]
    })
  })
  await firstRetry
  expect(f.changed.mock.lastCall?.[0].slots[0]).toEqual(nextFailure)
  expect(f.changed.mock.lastCall?.[0].retryPending).toEqual([true, false, false, false])
  await f.search.retry(0)
  expect(f.control.mock.calls.filter(([command]) => command.action === 'retry')).toEqual([
    [{ action: 'retry', captureId: CAPTURE_ID, slot: 0, requestId: REQUEST_ID }],
    [{ action: 'retry', captureId: CAPTURE_ID, slot: 0, requestId: nextRequestId }]
  ])

  nextResponse.resolve({
    ok: true,
    snapshot: searchSnapshot({
      revision: 6,
      slots: [nextFailure, ...searchSnapshot().slots.slice(1)]
    })
  })
  await nextRetry
  expect(f.changed.mock.lastCall?.[0].retryPending).toEqual([false, false, false, false])
  expect(f.changed.mock.lastCall?.[0].slots[0]).toEqual(nextFailure)
})
