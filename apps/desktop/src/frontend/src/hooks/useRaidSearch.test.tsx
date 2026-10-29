// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useRaidSearch } from './useRaidSearch'
import type { CaptureSearch, createCaptureSearch } from '../lib/capture-search'
import { emptySearchSlots } from '../lib/slots'
import type { SearchView } from '../types/search'
import type { AsyncIPCFunctions } from '../../../preload/common/types/ipc'
import type { SearchApi, SearchSlot } from '../../../preload/common/types/search'
import {
  CAPTURE_ID,
  REQUEST_ID,
  searchRow,
  searchSlot
} from '../../../preload/api/search-test-fixture'

const moduleMocks = vi.hoisted(() => ({ create: vi.fn<typeof createCaptureSearch>() }))
vi.mock('../lib/capture-search', () => ({ createCaptureSearch: moduleMocks.create }))

const raidApi: SearchApi & {
  notifyOcrCandidatesDetected: AsyncIPCFunctions['notifyRaidOcrCandidatesDetected']
} = {
  controlCharacterSearch: vi.fn<SearchApi['controlCharacterSearch']>(),
  onCharacterSearchChanged: vi.fn<SearchApi['onCharacterSearchChanged']>(),
  notifyOcrCandidatesDetected: vi.fn<AsyncIPCFunctions['notifyRaidOcrCandidatesDetected']>()
}
let value: ReturnType<typeof useRaidSearch>
let initial: ReturnType<typeof useRaidSearch>
let bridge: CaptureSearch
let begin: ReturnType<typeof Promise.withResolvers<string | null>>
let root: Root

function Harness(): null {
  const current = useRaidSearch()
  useLayoutEffect(() => {
    value = current
  })

  return null
}

function view(slots: SearchSlot[]): SearchView {
  return { ready: true, slots, connectionFailed: false }
}

function found(slot: number, requestId = REQUEST_ID): SearchSlot {
  return searchSlot({ slot, requestId, state: 'success', rows: [searchRow] })
}

async function publish(slots: SearchSlot[]): Promise<void> {
  const options = moduleMocks.create.mock.lastCall![0]
  await act(async () => options.onChange(view(slots)))
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  begin = Promise.withResolvers<string | null>()
  bridge = {
    connect: vi.fn(),
    begin: vi.fn(() => begin.promise),
    end: vi.fn(),
    observe: vi.fn(),
    lookup: vi.fn(),
    dispose: vi.fn()
  }
  moduleMocks.create.mockReset().mockReturnValue(bridge)
  vi.stubGlobal('raidSearch', raidApi)
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<Harness />))
  initial = value
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('공대 검색 API에 12자리 수명으로 연결하고 조회한 슬롯만 연결을 기다리는 동안 진행 중으로 보인다', async () => {
  expect(moduleMocks.create).toHaveBeenCalledOnce()
  expect(moduleMocks.create.mock.lastCall![0]).toMatchObject({ api: raidApi, slotCount: 12 })
  expect(value.slots).toHaveLength(12)

  await act(async () => value.lookupSlot(9, '열번째', 'siroco'))
  expect(value.slots.map((slot) => slot.state)).toEqual(
    Array.from({ length: 12 }, (_, slot) => (slot === 9 ? 'pending' : 'idle'))
  )
  expect(bridge.lookup).not.toHaveBeenCalled()

  await act(async () => begin.resolve(CAPTURE_ID))
  expect(bridge.lookup).toHaveBeenCalledExactlyOnceWith({
    slot: 9,
    nickname: '열번째',
    serverId: 'siroco'
  })
  expect(value.slots[9].state).toBe('idle')
})

it('main이 보낸 슬롯별 검색 상태를 그 슬롯 번호대로 전한다', async () => {
  const slots = emptySearchSlots(12)
  slots[0] = found(0)
  slots[4] = searchSlot({ slot: 4, state: 'pending' })
  slots[11] = searchSlot({ slot: 11, state: 'empty' })
  await publish(slots)
  expect(value.slots.map((slot) => slot.state)).toEqual([
    'success',
    'idle',
    'idle',
    'idle',
    'pending',
    'idle',
    'idle',
    'idle',
    'idle',
    'idle',
    'idle',
    'empty'
  ])
})

function ocr(slot: number, nickname = '공대원') {
  return { slot, nickname, candidateNicknames: [nickname], portrait: null }
}

it('공대 캡처의 이름 관측은 공대 수명의 OCR 채널로 연결하고 그 슬롯에 그대로 알린다', async () => {
  expect(moduleMocks.create.mock.lastCall![0]).toMatchObject({
    api: raidApi,
    notifyOcr: raidApi.notifyOcrCandidatesDetected,
    slotCount: 12
  })
  await act(async () => value.observeOcr(ocr(11)))
  expect(bridge.observe).toHaveBeenCalledExactlyOnceWith(ocr(11))
})

it('회차는 수명을 새로 시작하고 그 뒤의 서버 지정 조회는 회차의 수명을 기다려 쓴다', async () => {
  const controller = new AbortController()
  let started: Promise<string | null> | undefined
  await act(async () => {
    started = value.beginRound(controller.signal)
  })
  expect(bridge.begin).toHaveBeenCalledOnce()

  await act(async () => value.lookupSlot(2, '직접조회', 'cain'))
  expect(bridge.begin).toHaveBeenCalledOnce()
  expect(value.slots[2].state).toBe('pending')
  await act(async () => begin.resolve(CAPTURE_ID))
  await expect(started).resolves.toBe(CAPTURE_ID)
  expect(bridge.lookup).toHaveBeenCalledExactlyOnceWith({
    slot: 2,
    nickname: '직접조회',
    serverId: 'cain'
  })
})

it('회차 중 직접 조회한 슬롯은 캡처 machine이 처음 받은 함수로 온 늦은 OCR 이름으로도 덮지 않고 다음 회차에서 다시 받는다', async () => {
  await act(async () => {
    initial.beginRound(new AbortController().signal)
  })
  await act(async () => begin.resolve(CAPTURE_ID))
  await act(async () => value.lookupSlot(5, '직접조회', 'cain'))
  expect(value.manualSlots[5]).toBe(true)

  await act(async () => {
    initial.observeOcr(ocr(5))
    initial.observeOcr(ocr(6))
  })
  expect(bridge.observe).toHaveBeenCalledExactlyOnceWith(ocr(6))

  await act(async () => {
    initial.beginRound(new AbortController().signal)
  })
  expect(value.manualSlots.every((manual) => !manual)).toBe(true)
  await act(async () => initial.observeOcr(ocr(5)))
  expect(bridge.observe).toHaveBeenLastCalledWith(ocr(5))
})

it('수명 시작 중 회차가 취소되면 기다리던 조회의 진행 표시를 거두고 다음 조회가 수명을 다시 시작한다', async () => {
  const controller = new AbortController()
  await act(async () => {
    value.beginRound(controller.signal)
  })
  await act(async () => value.lookupSlot(3, '직접조회', 'cain'))
  expect(value.slots[3].state).toBe('pending')

  await act(async () => controller.abort())
  expect(value.slots[3].state).toBe('idle')
  await act(async () => begin.resolve(null))
  expect(value.connectionFailed).toBe(false)
  expect(bridge.lookup).not.toHaveBeenCalled()

  begin = Promise.withResolvers<string | null>()
  await act(async () => value.lookupSlot(3, '직접조회', 'cain'))
  expect(bridge.begin).toHaveBeenCalledTimes(2)
})
