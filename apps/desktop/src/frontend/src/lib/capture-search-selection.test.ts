import { expect, it, vi } from 'vitest'
import { createCaptureSearch } from './capture-search'
import {
  CAPTURE_ID,
  REQUEST_ID,
  searchSnapshot,
  searchSlot,
  searchRow
} from '../../../preload/api/search-test-fixture'
import type { SearchApi, SearchSnapshot } from '../../../preload/common/types/search'
import type { SearchView } from '../types/search'

it('화면의 현재 선택만 상세 참조로 사용하고 clear와 종료 즉시 제거한다', async () => {
  let snapshot = searchSnapshot({ captureId: null })
  let emit: (next: SearchSnapshot) => void = () => {}
  const control = vi.fn<SearchApi['controlCharacterSearch']>(async () => ({ ok: true, snapshot }))
  let ready = false
  const search = createCaptureSearch({
    api: {
      controlCharacterSearch: control,
      onCharacterSearchChanged: (listener) => {
        emit = listener

        return () => {}
      }
    },
    notify: async () => ({ ok: true, snapshot }),
    onChange: (view) => {
      ready = view.ready
    },
    onInvalidated: vi.fn()
  })
  search.connect()
  await vi.waitFor(() => expect(ready).toBe(true))
  snapshot = searchSnapshot({ revision: 2 })
  await search.begin({ signal: new AbortController().signal })
  search.observe({ slot: 0, nickname: '가나' })
  const selected = {
    ...searchRow,
    adventureName: null,
    jobName: null,
    jobGrowName: null,
    level: null,
    imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1',
    guildName: null,
    equipmentScore: null,
    serverRank: null,
    card: null
  }
  const success = searchSlot({ state: 'success', rows: [searchRow], selected })
  snapshot = searchSnapshot({ revision: 3, slots: [success, ...snapshot.slots.slice(1)] })
  emit(snapshot)
  expect(search.selectedReference(0)).toEqual({
    captureId: CAPTURE_ID,
    slot: 0,
    requestId: REQUEST_ID
  })
  expect(search.selectedReference(1)).toBeNull()
  expect(search.selectedReference(-1)).toBeNull()
  expect(search.selectedReference(0.5)).toBeNull()

  search.observe({ slot: 0, nickname: null })
  expect(search.selectedReference(0)).toBeNull()
  search.end()
  expect(search.selectedReference(0)).toBeNull()
  search.dispose()
})

it('공대 연결은 12자리 snapshot만 받아 12번째 자리 결과를 보이고 상세 참조를 만든다', async () => {
  const raidSlots = (slots: SearchSnapshot['slots'] = []): SearchSnapshot['slots'] =>
    Array.from(
      { length: 12 },
      (_, slot) => slots.find((current) => current.slot === slot) ?? idleSlot(slot)
    )
  let snapshot = searchSnapshot({ captureId: null, slots: raidSlots() })
  let emit: (next: SearchSnapshot) => void = () => {}
  let view: SearchView | null = null
  const control = vi.fn<SearchApi['controlCharacterSearch']>(async () => ({ ok: true, snapshot }))
  const search = createCaptureSearch({
    api: {
      controlCharacterSearch: control,
      onCharacterSearchChanged: (listener) => {
        emit = listener

        return () => {}
      }
    },
    onChange: (next) => {
      view = next
    },
    onInvalidated: vi.fn(),
    slotCount: 12
  })
  search.connect()
  await vi.waitFor(() => expect(view?.ready).toBe(true))
  expect(view!.slots).toHaveLength(12)
  expect(view!.retryPending).toHaveLength(12)
  snapshot = searchSnapshot({ revision: 2, slots: raidSlots() })
  await search.begin({ signal: new AbortController().signal })
  search.lookup({ slot: 11, nickname: '가나', serverId: 'cain' })
  expect(control).toHaveBeenLastCalledWith({
    action: 'lookup',
    captureId: CAPTURE_ID,
    slot: 11,
    observationRevision: 1,
    nickname: '가나',
    serverId: 'cain'
  })
  const selected = {
    ...searchRow,
    adventureName: null,
    jobName: null,
    jobGrowName: null,
    level: null,
    imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1',
    guildName: null,
    equipmentScore: null,
    serverRank: null,
    card: null
  }
  const success = searchSlot({ slot: 11, state: 'success', rows: [searchRow], selected })
  snapshot = searchSnapshot({ revision: 3, slots: raidSlots([success]) })
  emit(snapshot)
  expect(view!.slots[11].state).toBe('success')
  expect(search.selectedReference(11)).toEqual({
    captureId: CAPTURE_ID,
    slot: 11,
    requestId: REQUEST_ID
  })
  expect(search.selectedReference(12)).toBeNull()
  // 파티 수명의 네 자리 snapshot은 공대 연결에 반영하지 않는다.
  emit(searchSnapshot({ revision: 4 }))
  expect(view!.slots).toHaveLength(12)
  expect(view!.slots[11].state).toBe('success')
  search.dispose()
})

function idleSlot(slot: number): SearchSnapshot['slots'][number] {
  return {
    slot,
    observationRevision: 0,
    requestId: null,
    nickname: null,
    state: 'idle',
    rows: [],
    error: null
  }
}
