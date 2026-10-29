// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCharacterSearch } from './useCharacterSearch'
import type {
  CaptureSearch,
  createCaptureSearch,
  OcrCaptureObservation
} from '../lib/capture-search'
import { emptySearchSlots } from '../lib/slots'
import type { SearchView } from '../types/search'
import type { CharacterChoice, SearchSlot } from '../../../preload/common/types/search'
import {
  CAPTURE_ID,
  REQUEST_ID,
  searchRow,
  searchSlot
} from '../../../preload/api/search-test-fixture'

// 파티 검색 수명의 연결(createCaptureSearch)만 바꾸고 useManualCharacterLookup은 그대로 쓴다.
const mocks = vi.hoisted(() => ({ create: vi.fn<typeof createCaptureSearch>() }))
vi.mock('../lib/capture-search', () => ({ createCaptureSearch: mocks.create }))

const SLOT = 1
const NEXT_REQUEST_ID = '00000000-0000-4000-8000-000000000088'
let value: ReturnType<typeof useCharacterSearch>
let initial: ReturnType<typeof useCharacterSearch>
let bridge: CaptureSearch
let root: Root
let container: HTMLDivElement

function choice(serverId: string, serverName: string): CharacterChoice {
  return {
    ...searchRow,
    characterId: `synthetic-${serverId}`,
    serverId,
    serverName,
    adventureName: null,
    face: null
  }
}

function selected(serverId: string) {
  return {
    ...searchRow,
    serverId,
    adventureName: null,
    jobName: null,
    jobGrowName: null,
    level: null,
    imageUrl: `https://img-api.neople.co.kr/df/servers/${serverId}/characters/synthetic-character?zoom=1`,
    guildName: null,
    equipmentScore: null,
    card: null
  }
}

function viewWithSlot(slot: SearchSlot): SearchView {
  const slots = emptySearchSlots().map((current) => (current.slot === slot.slot ? slot : current))

  return { ready: true, slots, connectionFailed: false }
}

function ocrSlotWithChoices(requestId = REQUEST_ID): SearchSlot {
  return searchSlot({
    slot: SLOT,
    requestId,
    state: 'success',
    rows: [searchRow],
    selected: selected('cain'),
    selectionMethod: 'portrait',
    choices: [choice('cain', '카인'), choice('siroco', '시로코')]
  })
}

function lookupSlot(overrides: Partial<SearchSlot>): SearchSlot {
  return searchSlot({
    slot: SLOT,
    observationRevision: 2,
    requestId: NEXT_REQUEST_ID,
    ...overrides
  })
}

async function publish(view: SearchView): Promise<void> {
  const onChange = mocks.create.mock.lastCall![0].onChange
  await act(async () => onChange(view))
}

function lookups(): string[] {
  return vi.mocked(bridge.lookup).mock.calls.map(([input]) => input.serverId)
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
  bridge = {
    connect: vi.fn(),
    begin: vi.fn(async () => CAPTURE_ID),
    end: vi.fn(),
    observe: vi.fn(),
    lookup: vi.fn(),
    dispose: vi.fn()
  }
  mocks.create.mockReset().mockReturnValue(bridge)
  vi.stubGlobal('search', {})
  vi.stubGlobal('api', {
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
  initial = value
  await act(async () => value.begin(new AbortController().signal))
  await publish(viewWithSlot(ocrSlotWithChoices()))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('캡처 검색이 준 후보로 자동 선택을 보여 주는 후보 창을 만든다', () => {
  expect(value.candidatePickers[SLOT]).toEqual({
    choices: [choice('cain', '카인'), choice('siroco', '시로코')],
    shownServerId: 'cain',
    previewServerId: null
  })
  expect(value.candidatePickers[0]).toBeNull()
})

it('다른 후보를 한 번 누르면 같은 수명에서 그 서버로 조회해 미리보기하고 다시 누르면 조회 없이 확정한다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'siroco'))

  expect(bridge.lookup).toHaveBeenCalledExactlyOnceWith({
    slot: SLOT,
    nickname: searchRow.characterName,
    serverId: 'siroco'
  })
  expect(bridge.begin).toHaveBeenCalledOnce()
  expect(value.candidatePickers[SLOT]).toMatchObject({
    shownServerId: 'siroco',
    previewServerId: 'siroco'
  })
  expect(value.manualSlots[SLOT]).toBe(true)

  await act(async () => value.pickCandidate(SLOT, 'siroco'))

  expect(value.candidatePickers[SLOT]).toBeNull()
  expect(bridge.lookup).toHaveBeenCalledOnce()
})

it('이미 보이는 자동 선택 후보를 누르면 다시 조회하지 않고 미리보기만 한다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'cain'))

  expect(bridge.lookup).not.toHaveBeenCalled()
  expect(value.candidatePickers[SLOT]?.previewServerId).toBe('cain')
})

it('미리보기를 다른 후보로 옮기면 옮긴 후보로 다시 조회한다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'siroco'))
  await act(async () => value.pickCandidate(SLOT, 'cain'))

  expect(lookups()).toEqual(['siroco', 'cain'])
  expect(value.candidatePickers[SLOT]?.previewServerId).toBe('cain')
})

it('후보 창에 없는 서버는 무시한다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'anton'))

  expect(bridge.lookup).not.toHaveBeenCalled()
  expect(value.candidatePickers[SLOT]?.previewServerId).toBeNull()
})

it('미리보기 조회 중에는 처음 보이던 캐릭터를 두고, 결과가 슬롯을 덮어도 후보 창이 남아 옮기고 확정할 수 있다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'siroco'))
  await publish(viewWithSlot(lookupSlot({ state: 'pending', rows: [] })))

  expect(value.slots[SLOT]).toMatchObject({ state: 'success', selected: { serverId: 'cain' } })
  expect(value.candidatePickers[SLOT]).toEqual({
    choices: [choice('cain', '카인'), choice('siroco', '시로코')],
    shownServerId: 'siroco',
    previewServerId: 'siroco'
  })

  const result = lookupSlot({
    state: 'success',
    rows: [{ ...searchRow, serverId: 'siroco' }],
    selected: selected('siroco'),
    selectionMethod: 'manual'
  })
  await publish(viewWithSlot(result))

  expect(value.slots[SLOT]).toEqual(result)
  expect(value.candidatePickers[SLOT]).toMatchObject({
    choices: [choice('cain', '카인'), choice('siroco', '시로코')],
    previewServerId: 'siroco'
  })

  await act(async () => value.pickCandidate(SLOT, 'cain'))
  expect(lookups()).toEqual(['siroco', 'cain'])
  await act(async () => value.pickCandidate(SLOT, 'cain'))
  expect(value.candidatePickers[SLOT]).toBeNull()
  expect(lookups()).toEqual(['siroco', 'cain'])
})

it('미리보기 조회가 실패해도 후보 창이 남아 다른 후보를 고를 수 있다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'siroco'))
  const failure = lookupSlot({ state: 'failure', rows: [], error: { code: 'NEOPLE_TIMEOUT' } })
  await publish(viewWithSlot(failure))

  expect(value.slots[SLOT]).toEqual(failure)
  expect(value.candidatePickers[SLOT]?.previewServerId).toBe('siroco')
  await act(async () => value.pickCandidate(SLOT, 'cain'))
  expect(lookups()).toEqual(['siroco', 'cain'])
})

it.each(['조회 전', '미리보기 중'] as const)(
  '%s 서버 칩으로 직접 조회하면 후보 창을 닫는다',
  async (state) => {
    if (state === '미리보기 중') {
      await act(async () => value.pickCandidate(SLOT, 'cain'))
    }

    await act(async () => value.lookupSlot(SLOT, searchRow.characterName, 'anton'))

    expect(bridge.lookup).toHaveBeenLastCalledWith({
      slot: SLOT,
      nickname: searchRow.characterName,
      serverId: 'anton'
    })
    expect(value.candidatePickers[SLOT]).toBeNull()
  }
)

it('조회 없이 확정한 자동 선택은 같은 슬롯의 새 요청이 후보 창을 다시 열게 한다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'cain'))
  await act(async () => value.pickCandidate(SLOT, 'cain'))
  expect(value.candidatePickers[SLOT]).toBeNull()

  await publish(viewWithSlot(ocrSlotWithChoices(NEXT_REQUEST_ID)))

  expect(value.candidatePickers[SLOT]).toMatchObject({
    shownServerId: 'cain',
    previewServerId: null
  })
})

it('회차를 끝내면 누른 후보를 버리고 다음 회차의 후보 창을 처음부터 보인다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'siroco'))
  await act(async () => value.end())
  expect(bridge.end).toHaveBeenCalled()

  await act(async () => value.begin(new AbortController().signal))
  await publish(viewWithSlot(ocrSlotWithChoices(NEXT_REQUEST_ID)))

  expect(value.manualSlots).toEqual([false, false, false, false])
  expect(value.candidatePickers[SLOT]).toMatchObject({
    shownServerId: 'cain',
    previewServerId: null
  })
})

function ocr(slot: number): OcrCaptureObservation {
  return { slot, nickname: '파티원', candidateNicknames: ['파티원'], portrait: null }
}

it('캡처 machine이 처음 받은 OCR 관측 함수도 수동 조회한 슬롯은 건너뛰고 캡처를 끝내면 다시 넘긴다', async () => {
  await act(async () => value.lookupSlot(SLOT, searchRow.characterName, 'anton'))
  await act(async () => {
    initial.observeOcr(ocr(SLOT))
    initial.observeOcr(ocr(0))
  })
  expect(bridge.observe).toHaveBeenCalledExactlyOnceWith(ocr(0))

  await act(async () => initial.end())
  expect(value.manualSlots[SLOT]).toBe(false)
  await act(async () => initial.observeOcr(ocr(SLOT)))
  expect(bridge.observe).toHaveBeenLastCalledWith(ocr(SLOT))
})
