import { beforeEach, expect, it, vi } from 'vitest'
import type { SearchControl, ManualSearchApi } from '../common/types/search'
import {
  CAPTURE_ID,
  REQUEST_ID,
  invalidSearchSnapshots,
  searchRow,
  searchSlot,
  searchSnapshot,
  withSearchSlot,
  type SearchTestApi,
  type ObservationTestApi
} from './search-test-fixture'

const renderer = await vi.hoisted(async () => {
  const { EventEmitter } = await import('node:events')
  const events = new EventEmitter()
  const invoke = vi.fn()
  const on = vi.fn(events.on.bind(events))
  const removeListener = vi.fn(events.removeListener.bind(events))
  const expose = vi.fn<(key: string, api: unknown) => void>()

  return { invoke, on, removeListener, expose, events }
})
vi.mock('electron', () => ({
  ipcRenderer: renderer,
  contextBridge: { exposeInMainWorld: renderer.expose }
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  renderer.events.removeAllListeners()
  renderer.invoke.mockResolvedValue({ ok: true, snapshot: searchSnapshot() })
})

async function exposedSearch(): Promise<{
  search: SearchTestApi
  capture: ObservationTestApi
  manual: ManualSearchApi
}> {
  await import('../index')
  const exposed = new Map(renderer.expose.mock.calls)
  expect(exposed.get('search'), '검색 전용 preload API').toBeDefined()
  const search = exposed.get('search') as SearchTestApi
  const manual = exposed.get('manualSearch') as ManualSearchApi
  const capture = exposed.get('api') as ObservationTestApi

  return { search, manual, capture }
}

it('검색 feature는 제어 invoke와 단일 event만 노출하고 기존 notify를 확장한다', async () => {
  const { search, capture } = await exposedSearch()
  expect(Object.keys(search).sort()).toEqual(['controlCharacterSearch', 'onCharacterSearchChanged'])
  const controls: SearchControl[] = [
    { action: 'read' },
    { action: 'begin' },
    { action: 'end', captureId: CAPTURE_ID },
    { action: 'clear', captureId: CAPTURE_ID, slot: 2, observationRevision: 3 },
    { action: 'retry', captureId: CAPTURE_ID, slot: 2, requestId: REQUEST_ID }
  ]
  for (const control of controls) {
    await search.controlCharacterSearch(control)
  }
  const observation = { captureId: CAPTURE_ID, slot: 2, observationRevision: 4, nickname: '가나' }
  await capture.notifyStableNicknameDetected(observation)
  const ocr = { ...observation, candidateNicknames: ['가나', '다라'], portrait: null }
  await capture.notifyOcrCandidatesDetected(ocr)
  expect(renderer.invoke.mock.calls).toEqual([
    ...controls.map((control) => ['controlCharacterSearch', control]),
    ['notifyStableNicknameDetected', observation],
    ['notifyOcrCandidatesDetected', ocr]
  ])
})

it.each([
  ['캡처', 'search', 'characterSearchChanged'],
  ['직접 검색', 'manual', 'manualSearchChanged']
] as const)(
  '%s 구독 해제는 해당 listener만 멈추고 잘못된 DTO도 전달하지 않는다',
  async (_name, kind, channel) => {
    const { search, manual } = await exposedSearch()
    const api = kind === 'search' ? search : manual
    const first = vi.fn()
    const second = vi.fn()
    const unsubscribe = api.onCharacterSearchChanged(first)
    const unsubscribeSecond = api.onCharacterSearchChanged(second)
    const [[registeredChannel, firstWrapper], [, secondWrapper]] = renderer.on.mock.calls
    const snapshot = searchSnapshot()
    const rawEvent = { sender: 'private' }

    renderer.events.emit(channel, rawEvent, snapshot)
    unsubscribe()
    renderer.events.emit(channel, rawEvent, { ...snapshot, private: true })
    const nextSnapshot = searchSnapshot({ revision: 2 })
    renderer.events.emit(channel, rawEvent, nextSnapshot)

    expect(registeredChannel).toBe(channel)
    expect(first).toHaveBeenCalledExactlyOnceWith(snapshot)
    expect(second.mock.calls).toEqual([[snapshot], [nextSnapshot]])
    expect(firstWrapper).not.toBe(secondWrapper)
    expect(renderer.removeListener).toHaveBeenCalledExactlyOnceWith(channel, firstWrapper)
    unsubscribeSecond()
    renderer.events.emit(channel, rawEvent, searchSnapshot({ revision: 3 }))
    expect(second).toHaveBeenCalledTimes(2)
    expect(renderer.events.listenerCount(channel)).toBe(0)
  }
)

it('같은 callback의 캡처 구독을 해제해도 직접 검색 구독은 유지된다', async () => {
  const { search, manual } = await exposedSearch()
  const listener = vi.fn()
  const stopCapture = search.onCharacterSearchChanged(listener)
  const stopManual = manual.onCharacterSearchChanged(listener)
  const snapshot = searchSnapshot()

  stopCapture()
  renderer.events.emit('characterSearchChanged', { sender: 'private' }, snapshot)
  expect(listener).not.toHaveBeenCalled()
  renderer.events.emit('manualSearchChanged', { sender: 'private' }, snapshot)

  expect(listener).toHaveBeenCalledExactlyOnceWith(snapshot)
  stopManual()
  expect(renderer.events.listenerCount('characterSearchChanged')).toBe(0)
  expect(renderer.events.listenerCount('manualSearchChanged')).toBe(0)
})

it.each(invalidSearchSnapshots)(
  '잘못된 %s DTO는 invoke와 event에서 renderer로 넘기지 않는다',
  async (_name, invalid) => {
    const capture = (await import('./capture')) as unknown as ObservationTestApi
    renderer.invoke.mockResolvedValue({ ok: true, snapshot: invalid() })
    await expect(
      capture.notifyStableNicknameDetected({
        captureId: CAPTURE_ID,
        slot: 0,
        observationRevision: 1,
        nickname: '가나'
      })
    ).rejects.toThrow()
    const { search } = await exposedSearch()
    await expect(search.controlCharacterSearch({ action: 'read' })).rejects.toThrow()
    const listener = vi.fn()
    search.onCharacterSearchChanged(listener)
    renderer.on.mock.calls[0][1]({}, invalid())
    expect(listener).not.toHaveBeenCalled()
  }
)

it.each([
  { ok: true, error: { code: 'SEARCH_BUSY' }, snapshot: searchSnapshot() },
  { ok: false, error: { code: 'UNKNOWN' }, snapshot: searchSnapshot() },
  { ok: false, error: { code: 'SEARCH_BUSY', message: 'private' }, snapshot: searchSnapshot() },
  { ok: true, snapshot: searchSnapshot(), private: true }
])('명령 결과의 exact shape도 검사한다: %j', async (invalid) => {
  const { search } = await exposedSearch()
  renderer.invoke.mockResolvedValue(invalid)
  await expect(search.controlCharacterSearch({ action: 'read' })).rejects.toThrow()
})

it('승인된 상태, nullable 값과 후보 순서를 보존한다', async () => {
  const { search } = await exposedSearch()
  const rows = [searchRow, { ...searchRow, characterId: 'second', serverName: null, fame: -1.5 }]
  const slots = [
    searchSlot(),
    searchSlot({ state: 'success', rows }),
    searchSlot({ state: 'empty' }),
    searchSlot({
      state: 'failure',
      error: { code: 'SEARCH_NETWORK_ERROR', retryAfterSeconds: null }
    }),
    searchSlot({ state: 'failure', error: { code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 0 } })
  ]
  for (const slot of slots) {
    const result = { ok: true, snapshot: withSearchSlot(slot) }
    renderer.invoke.mockResolvedValueOnce(result)
    expect(await search.controlCharacterSearch({ action: 'read' })).toEqual(result)
  }
})

it.each([
  'INVALID_SEARCH_COMMAND',
  'SEARCH_NOT_ALLOWED',
  'STALE_SEARCH',
  'SEARCH_BUSY',
  'SEARCH_RETRY_NOT_READY'
])('정제된 명령 거절 %s는 예외나 검색 0건으로 바꾸지 않는다', async (code) => {
  const { search } = await exposedSearch()
  const result = { ok: false, error: { code }, snapshot: searchSnapshot() }
  renderer.invoke.mockResolvedValue(result)

  expect(await search.controlCharacterSearch({ action: 'read' })).toEqual(result)
})

it.each([
  ['빈 characterId', { ...searchRow, characterId: '' }],
  ['공백뿐인 characterName', { ...searchRow, characterName: ' \t' }],
  ['빈 serverId', { ...searchRow, serverId: '' }],
  ['문자열 fame', { ...searchRow, fame: '0' }],
  ['boolean fame', { ...searchRow, fame: true }],
  [
    '누락된 serverName',
    { characterId: 'synthetic-character', characterName: '가나', serverId: 'cain', fame: 0 }
  ],
  [
    '누락된 fame',
    {
      characterId: 'synthetic-character',
      characterName: '가나',
      serverId: 'cain',
      serverName: '카인'
    }
  ]
])('후보의 %s는 clone된 invoke, event DTO에서도 거절한다', async (_name, row) => {
  const { search } = await exposedSearch()
  const snapshot = searchSnapshot()
  const invalid = {
    ...snapshot,
    slots: [{ ...searchSlot(), state: 'success', rows: [row] }, ...snapshot.slots.slice(1)]
  }
  renderer.invoke.mockResolvedValue(structuredClone({ ok: true, snapshot: invalid }))

  await expect(search.controlCharacterSearch({ action: 'read' })).rejects.toThrow(
    '검색 연결의 응답을 확인하지 못했습니다.'
  )
  const listener = vi.fn()
  const unsubscribe = search.onCharacterSearchChanged(listener)
  renderer.events.emit('characterSearchChanged', { sender: 'private' }, structuredClone(invalid))
  expect(listener).not.toHaveBeenCalled()
  unsubscribe()
})

it('직접 검색 preload는 전용 invoke, event 채널과 같은 검증 DTO를 사용한다', async () => {
  const { manual } = await exposedSearch()
  expect(Object.keys(manual).sort()).toEqual([
    'controlCharacterSearch',
    'notifyManualNickname',
    'onCharacterSearchChanged'
  ])
  const observation = { captureId: CAPTURE_ID, slot: 0, observationRevision: 1, nickname: '가나' }
  await manual.controlCharacterSearch({ action: 'begin' })
  await manual.notifyManualNickname(observation)
  expect(renderer.invoke.mock.calls).toEqual([
    ['controlManualSearch', { action: 'begin' }],
    ['notifyManualNickname', observation]
  ])
  const listener = vi.fn()
  const unsubscribe = manual.onCharacterSearchChanged(listener)
  const [channel, wrapper] = renderer.on.mock.calls[0]
  wrapper({ sender: 'private' }, searchSnapshot())
  expect(channel).toBe('manualSearchChanged')
  expect(listener).toHaveBeenCalledExactlyOnceWith(searchSnapshot())
  unsubscribe()
  expect(renderer.removeListener).toHaveBeenCalledExactlyOnceWith(channel, wrapper)
})

it('직접 검색 preload도 잘못된 invoke, event DTO를 전달하지 않는다', async () => {
  const { manual } = await exposedSearch()
  const invalid = { ...searchSnapshot(), private: true }
  renderer.invoke.mockResolvedValue({ ok: true, snapshot: invalid })
  await expect(manual.controlCharacterSearch({ action: 'read' })).rejects.toThrow()
  await expect(
    manual.notifyManualNickname({
      captureId: CAPTURE_ID,
      slot: 0,
      observationRevision: 1,
      nickname: '가나'
    })
  ).rejects.toThrow()
  const listener = vi.fn()
  manual.onCharacterSearchChanged(listener)
  renderer.on.mock.calls[0][1]({}, invalid)
  expect(listener).not.toHaveBeenCalled()
})
