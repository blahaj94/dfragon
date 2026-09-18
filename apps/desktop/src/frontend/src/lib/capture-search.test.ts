import { afterEach, expect, it, vi, type Mock } from 'vitest'
import type {
  SearchApi,
  SearchCommandResult,
  SearchSnapshot
} from '../../../preload/common/types/search'
import { CAPTURE_ID, searchSnapshot } from '../../../preload/api/search-test-fixture'
import type { SearchView } from '../types/search'
import { CaptureSearch } from './capture-search'

const searches: CaptureSearch[] = []
afterEach(() => searches.splice(0).forEach((search) => search.dispose()))

/** 실제 SearchConnection을 통과시키면서 main 응답·event 순서만 제어한다. */
async function fixture(): Promise<{
  search: CaptureSearch
  control: Mock<SearchApi['controlCharacterSearch']>
  notify: Mock
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
  const notify = vi.fn(async (): Promise<SearchCommandResult> => ({ ok: true, snapshot: current }))
  const changed = vi.fn<(view: SearchView) => void>()
  const invalidated = vi.fn()
  const search = new CaptureSearch({
    api: {
      controlCharacterSearch: control,
      onCharacterSearchChanged: (next) => {
        listener = next
        return () => {}
      }
    },
    notify,
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
    changed,
    invalidated,
    emit: (snapshot) => {
      current = snapshot
      listener(snapshot)
    }
  }
}

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

it('실행 중 end·dispose를 반복해도 소유 ID는 한 번만 end하고 폐기 뒤 begin은 보내지 않는다', async () => {
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
