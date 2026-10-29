import { expect, it, vi } from 'vitest'
import { createCaptureSearch } from './capture-search'
import {
  CAPTURE_ID,
  searchSnapshot,
  searchSlot,
  searchRow
} from '../../../preload/api/search-test-fixture'
import type { SearchApi, SearchSnapshot } from '../../../preload/common/types/search'
import type { SearchView } from '../types/search'

it('공대 연결은 12자리 snapshot의 12번째 슬롯 결과를 보인다', async () => {
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
    notifyOcr: vi.fn(),
    onInvalidated: vi.fn(),
    slotCount: 12
  })
  search.connect()
  await vi.waitFor(() => expect(view?.ready).toBe(true))
  expect(view!.slots).toHaveLength(12)
  snapshot = searchSnapshot({ revision: 2, slots: raidSlots() })
  await search.begin({ signal: new AbortController().signal })
  search.lookup({ slot: 11, nickname: '가나', serverId: 'cain' })
  await vi.waitFor(() =>
    expect(control).toHaveBeenLastCalledWith({
      action: 'lookup',
      captureId: CAPTURE_ID,
      slot: 11,
      observationRevision: 1,
      nickname: '가나',
      serverId: 'cain'
    })
  )
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
  const success = searchSlot({ slot: 11, state: 'success', rows: [searchRow], selected })
  snapshot = searchSnapshot({ revision: 3, slots: raidSlots([success]) })
  emit(snapshot)
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
