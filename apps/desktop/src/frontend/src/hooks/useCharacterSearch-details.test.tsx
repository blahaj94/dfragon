// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCharacterSearch } from './useCharacterSearch'
import type { CaptureSearch, createCaptureSearch } from '../lib/capture-search'
import { emptySearchSlots } from '../lib/slots'
import type { SearchView } from '../types/search'
import type {
  CharacterSelectionReference,
  OpenCharacterDetailResult
} from '../../../preload/common/types/character-detail'
import type { AsyncIPCFunctions } from '../../../preload/common/types/ipc'
import {
  CAPTURE_ID,
  REQUEST_ID,
  searchRow,
  searchSlot
} from '../../../preload/api/search-test-fixture'

const moduleMocks = vi.hoisted(() => ({ create: vi.fn<typeof createCaptureSearch>() }))
vi.mock('../lib/capture-search', () => ({ createCaptureSearch: moduleMocks.create }))
let reference: CharacterSelectionReference | null
let value: ReturnType<typeof useCharacterSearch>
let root: Root
let container: HTMLDivElement
const open = vi.fn<AsyncIPCFunctions['openCharacterDetails']>()

function currentView(): SearchView {
  const selected = {
    ...searchRow,
    adventureName: null,
    jobName: null,
    jobGrowName: null,
    level: null,
    imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1'
  }
  const slots = emptySearchSlots().map((slot) => {
    if (reference?.slot === slot.slot) {
      return searchSlot({
        slot: slot.slot,
        requestId: reference.requestId,
        state: 'success',
        rows: [searchRow],
        selected
      })
    }

    return slot
  })

  return { ready: true, slots, retryPending: [false, false, false, false], connectionFailed: false }
}

function Harness({
  onRender
}: {
  onRender: (value: ReturnType<typeof useCharacterSearch>) => void
}): null {
  onRender(useCharacterSearch(vi.fn()))

  return null
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  reference = { captureId: CAPTURE_ID, slot: 1, requestId: REQUEST_ID }
  const bridge: CaptureSearch = {
    connect: vi.fn(),
    begin: vi.fn(),
    end: vi.fn(),
    observe: vi.fn(),
    lookup: vi.fn(),
    retry: vi.fn(),
    selectedReference: (slot) => {
      if (reference?.slot === slot) {
        return reference
      }

      return null
    },
    dispose: vi.fn()
  }
  moduleMocks.create.mockReturnValue(bridge)
  open.mockReset()
  vi.stubGlobal('search', {})
  vi.stubGlobal('api', {
    openCharacterDetails: open,
    notifyStableNicknameDetected: vi.fn(),
    notifyOcrCandidatesDetected: vi.fn()
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <Harness
        onRender={(next) => {
          value = next
        }}
      />
    )
  )
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('현재 선택의 중복 클릭은 한 번만 열고 성공 뒤에는 다시 포커스할 수 있다', async () => {
  const pending = Promise.withResolvers<OpenCharacterDetailResult>()
  open.mockReturnValueOnce(pending.promise).mockResolvedValue({ ok: true })
  await act(async () => {
    value.openDetails(1)
    value.openDetails(1)
  })
  expect(open).toHaveBeenCalledExactlyOnceWith(reference)
  await act(async () => pending.resolve({ ok: true }))
  await act(async () => value.openDetails(1))
  expect(open).toHaveBeenCalledTimes(2)
  expect(value.detailNotice).toBe('')
})

it('선택이 없으면 열지 않고 현재 선택의 실패만 정제된 안내로 표시한다', async () => {
  open.mockRejectedValue(new Error('private upstream information'))
  reference = null
  await act(async () => value.openDetails(1))
  expect(open).not.toHaveBeenCalled()
  reference = { captureId: CAPTURE_ID, slot: 1, requestId: REQUEST_ID }
  await act(async () => value.openDetails(1))
  expect(value.detailNotice).toBe('캐릭터 정보 창을 열지 못했습니다. 다시 시도해 주세요.')
  expect(value.connectionFailed).toBe(false)
})

it('이전 선택의 늦은 실패는 새 상태 안내를 덮어쓰지 않는다', async () => {
  const pending = Promise.withResolvers<OpenCharacterDetailResult>()
  open.mockReturnValueOnce(pending.promise)
  await act(async () => value.openDetails(1))
  reference = null
  await act(async () => pending.reject(new Error('stale failure')))
  expect(value.detailNotice).toBe('')
})

it.each(['슬롯 clear', '새 요청 선택', '새 캡처 선택'] as const)(
  '%s가 발행되면 이전 선택의 창 열기 오류를 지운다',
  async (change) => {
    open.mockResolvedValue({ ok: false })
    await act(async () => value.openDetails(1))
    expect(value.detailNotice).toBe('캐릭터 정보 창을 열지 못했습니다. 다시 시도해 주세요.')
    const original = reference!
    if (change === '슬롯 clear') {
      reference = null
    } else if (change === '새 요청 선택') {
      reference = { ...original, requestId: '00000000-0000-4000-8000-000000000088' }
    } else {
      reference = { ...original, captureId: '00000000-0000-4000-8000-000000000099' }
    }
    const publish = moduleMocks.create.mock.lastCall![0].onChange
    await act(async () => publish(currentView()))
    expect(value.detailNotice).toBe('')
    expect(open).toHaveBeenCalledOnce()

    reference = original
    await act(async () => publish(currentView()))
    expect(value.detailNotice).toBe('')
  }
)

it('현재 선택을 유지하는 다른 snapshot은 해당 선택의 오류를 지우지 않는다', async () => {
  open.mockResolvedValue({ ok: false })
  await act(async () => value.openDetails(1))
  const publish = moduleMocks.create.mock.lastCall![0].onChange
  await act(async () => publish(currentView()))
  expect(value.detailNotice).toBe('캐릭터 정보 창을 열지 못했습니다. 다시 시도해 주세요.')
})
