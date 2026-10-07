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
    imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/synthetic-character?zoom=1'
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
