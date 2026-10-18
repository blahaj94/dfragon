// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useRaidSearch } from './useRaidSearch'
import type { CaptureSearch, createCaptureSearch } from '../lib/capture-search'
import { emptySearchSlots } from '../lib/slots'
import type { SearchView } from '../types/search'
import type { CharacterSelectionReference } from '../../../preload/common/types/character-detail'
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

const raidApi: SearchApi = {
  controlCharacterSearch: vi.fn<SearchApi['controlCharacterSearch']>(),
  onCharacterSearchChanged: vi.fn<SearchApi['onCharacterSearchChanged']>()
}
const open = vi.fn<AsyncIPCFunctions['openCharacterDetails']>()
const NOTICE = '캐릭터 정보 창을 열지 못했습니다. 다시 시도해 주세요.'
let value: ReturnType<typeof useRaidSearch>
let bridge: CaptureSearch
let begin: ReturnType<typeof Promise.withResolvers<string | null>>
let reference: CharacterSelectionReference | null
let root: Root

function Harness(): null {
  const current = useRaidSearch()
  useLayoutEffect(() => {
    value = current
  })

  return null
}

function view(slots: SearchSlot[]): SearchView {
  return { ready: true, slots, retryPending: slots.map(() => false), connectionFailed: false }
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
  reference = null
  bridge = {
    connect: vi.fn(),
    begin: vi.fn(() => begin.promise),
    end: vi.fn(),
    observe: vi.fn(),
    lookup: vi.fn(),
    retry: vi.fn(),
    selectedReference: (slot) => (reference?.slot === slot ? reference : null),
    dispose: vi.fn()
  }
  moduleMocks.create.mockReset().mockReturnValue(bridge)
  open.mockReset()
  vi.stubGlobal('raidSearch', raidApi)
  vi.stubGlobal('api', { openCharacterDetails: open })
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<Harness />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('공대 검색 API에 12자리 수명으로 연결하고 조회한 자리만 연결을 기다리는 동안 진행 중으로 보인다', async () => {
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

it('main이 보낸 자리별 검색 상태를 그 자리 번호대로 전한다', async () => {
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

it('상세 창 열기 실패는 그 자리의 선택이 그대로일 때만 알린다', async () => {
  open.mockResolvedValue({ ok: false })
  const slots = emptySearchSlots(12)
  slots[7] = found(7)
  await publish(slots)
  reference = { captureId: CAPTURE_ID, slot: 7, requestId: REQUEST_ID }

  await act(async () => value.openDetails(7))
  expect(open).toHaveBeenCalledExactlyOnceWith(reference)
  expect(value.detailNotice).toBe(NOTICE)

  // 같은 자리를 다시 조회해 새 요청 결과가 오면 이전 캐릭터의 실패 안내를 지운다.
  slots[7] = found(7, '00000000-0000-4000-8000-000000000088')
  await publish(slots)
  expect(value.detailNotice).toBe('')
})

it('창을 여는 동안 그 자리를 다시 조회했다면 늦은 실패를 보이지 않는다', async () => {
  const pending = Promise.withResolvers<{ ok: boolean }>()
  open.mockReturnValueOnce(pending.promise)
  const slots = emptySearchSlots(12)
  slots[2] = found(2)
  await publish(slots)
  reference = { captureId: CAPTURE_ID, slot: 2, requestId: REQUEST_ID }
  await act(async () => value.openDetails(2))
  reference = { ...reference, requestId: '00000000-0000-4000-8000-000000000088' }
  await act(async () => pending.resolve({ ok: false }))
  expect(value.detailNotice).toBe('')
})
