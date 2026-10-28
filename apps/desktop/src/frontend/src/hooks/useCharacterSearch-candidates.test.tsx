// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCharacterSearch } from './useCharacterSearch'
import type { CaptureSearch, createCaptureSearch } from '../lib/capture-search'
import { emptySearchSlots } from '../lib/slots'
import type { SearchView } from '../types/search'
import type { CharacterChoice, SearchSlot } from '../../../preload/common/types/search'
import { REQUEST_ID, searchRow, searchSlot } from '../../../preload/api/search-test-fixture'

const mocks = vi.hoisted(() => ({
  manualSlots: null as SearchSlot[] | null,
  create: vi.fn<typeof createCaptureSearch>(),
  manualLookup: vi.fn<(slot: number, nickname: string, serverId: string) => void>()
}))
vi.mock('../lib/capture-search', () => ({ createCaptureSearch: mocks.create }))
vi.mock('./useManualCharacterLookup', () => ({
  useManualCharacterLookup: () => ({
    view: {
      ready: true,
      slots: mocks.manualSlots ?? emptySearchSlots(),
      retryPending: [false, false, false, false],
      connectionFailed: false
    },
    startingSlots: [false, false, false, false],
    bridge: { current: null },
    lookup: mocks.manualLookup,
    reset: vi.fn()
  })
}))

const SLOT = 1
const NEXT_REQUEST_ID = '00000000-0000-4000-8000-000000000088'
let value: ReturnType<typeof useCharacterSearch>
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

function viewWithChoices(requestId = REQUEST_ID): SearchView {
  const selected = {
    ...searchRow,
    adventureName: null,
    jobName: null,
    jobGrowName: null,
    level: null,
    imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1',
    guildName: null,
    equipmentScore: null,
    card: null
  }
  const slots = emptySearchSlots().map((slot) => {
    if (slot.slot !== SLOT) {
      return slot
    }

    return searchSlot({
      slot: SLOT,
      requestId,
      state: 'success',
      rows: [searchRow],
      selected,
      selectionMethod: 'portrait',
      choices: [choice('cain', '카인'), choice('siroco', '시로코')]
    })
  })

  return { ready: true, slots, retryPending: [false, false, false, false], connectionFailed: false }
}

async function publish(view: SearchView): Promise<void> {
  const onChange = mocks.create.mock.lastCall![0].onChange
  await act(async () => onChange(view))
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
  const bridge: CaptureSearch = {
    connect: vi.fn(),
    begin: vi.fn(),
    end: vi.fn(),
    observe: vi.fn(),
    lookup: vi.fn(),
    retry: vi.fn(),
    dispose: vi.fn()
  }
  mocks.create.mockReturnValue(bridge)
  mocks.manualLookup.mockReset()
  mocks.manualSlots = null
  vi.stubGlobal('search', {})
  vi.stubGlobal('api', {
    openCharacterDetails: vi.fn(),
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
  await publish(viewWithChoices())
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('캡처 검색이 준 후보로 자동 선택을 보여 주는 후보 줄을 만든다', () => {
  expect(value.candidatePickers[SLOT]).toEqual({
    choices: [choice('cain', '카인'), choice('siroco', '시로코')],
    shownServerId: 'cain',
    previewServerId: null
  })
  expect(value.candidatePickers[0]).toBeNull()
})

it('다른 후보를 한 번 누르면 그 서버로 조회해 미리보기하고 다시 누르면 조회 없이 확정한다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'siroco'))

  expect(mocks.manualLookup).toHaveBeenCalledExactlyOnceWith(
    SLOT,
    searchRow.characterName,
    'siroco'
  )
  expect(value.candidatePickers[SLOT]).toMatchObject({
    shownServerId: 'siroco',
    previewServerId: 'siroco'
  })
  expect(value.manualSlots[SLOT]).toBe(true)

  await act(async () => value.pickCandidate(SLOT, 'siroco'))

  expect(value.candidatePickers[SLOT]).toBeNull()
  expect(mocks.manualLookup).toHaveBeenCalledOnce()
})

it('이미 보이는 자동 선택 후보를 누르면 다시 조회하지 않고 미리보기만 한다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'cain'))

  expect(mocks.manualLookup).not.toHaveBeenCalled()
  expect(value.candidatePickers[SLOT]?.previewServerId).toBe('cain')
})

it('미리보기를 다른 후보로 옮기면 옮긴 후보로 다시 조회한다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'siroco'))
  await act(async () => value.pickCandidate(SLOT, 'cain'))

  expect(mocks.manualLookup.mock.calls.map(([, , serverId]) => serverId)).toEqual([
    'siroco',
    'cain'
  ])
  expect(value.candidatePickers[SLOT]?.previewServerId).toBe('cain')
})

it('후보 줄에 없는 서버는 무시한다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'anton'))

  expect(mocks.manualLookup).not.toHaveBeenCalled()
  expect(value.candidatePickers[SLOT]?.previewServerId).toBeNull()
})

it('서버 칩으로 직접 조회하면 후보 줄을 닫는다', async () => {
  await act(async () => value.lookupSlot(SLOT, searchRow.characterName, 'anton'))

  expect(mocks.manualLookup).toHaveBeenCalledExactlyOnceWith(SLOT, searchRow.characterName, 'anton')
  expect(value.candidatePickers[SLOT]).toBeNull()
})

it('캡처 검색의 새 요청과 캡처 종료는 이전 미리보기와 확정을 버린다', async () => {
  await act(async () => value.pickCandidate(SLOT, 'cain'))
  await act(async () => value.pickCandidate(SLOT, 'cain'))
  expect(value.candidatePickers[SLOT]).toBeNull()

  await publish(viewWithChoices(NEXT_REQUEST_ID))
  expect(value.candidatePickers[SLOT]?.previewServerId).toBeNull()

  await act(async () => value.pickCandidate(SLOT, 'cain'))
  await act(async () => value.end())
  expect(value.candidatePickers[SLOT]?.previewServerId).toBeNull()
})

it('미리보기 조회가 끝나기 전에는 대기 화면 대신 지금 보이는 캐릭터를 둔다', async () => {
  mocks.manualSlots = emptySearchSlots().map((slot) =>
    slot.slot === SLOT
      ? searchSlot({ slot: SLOT, requestId: NEXT_REQUEST_ID, state: 'pending', rows: [] })
      : slot
  )
  await act(async () => value.pickCandidate(SLOT, 'siroco'))

  expect(value.slots[SLOT]).toMatchObject({ state: 'success', selected: { serverId: 'cain' } })
  expect(value.candidatePickers[SLOT]?.previewServerId).toBe('siroco')
})
