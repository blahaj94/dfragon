// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useManualCharacterLookup } from './useManualCharacterLookup'
import { CAPTURE_ID, searchSnapshot } from '../../../preload/api/search-test-fixture'
import type { ManualSearchApi, SearchCommandResult } from '../../../preload/common/types/search'

let current: ReturnType<typeof useManualCharacterLookup>
let root: ReturnType<typeof createRoot>
const control = vi.fn<ManualSearchApi['controlCharacterSearch']>()
const api: ManualSearchApi = {
  controlCharacterSearch: control,
  onCharacterSearchChanged: () => () => {},
  notifyManualNickname: vi.fn()
}

function Harness(): null {
  current = useManualCharacterLookup()

  return null
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal('manualSearch', api)
  let snapshot = searchSnapshot({ captureId: null, revision: 0 })
  control.mockReset().mockImplementation(async (command) => {
    if (command.action === 'begin') {
      snapshot = searchSnapshot({ captureId: CAPTURE_ID, revision: snapshot.revision + 1 })
    } else if (command.action === 'end') {
      snapshot = searchSnapshot({ captureId: null, revision: snapshot.revision + 1 })
    }

    return { ok: true, snapshot }
  })
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<Harness />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('게임 캡처 없이 서버 지정 조회를 시작하고 같은 수명에서 다음 입력을 처리한다', async () => {
  await act(async () => current.lookup(2, '수동이름', 'siroco'))
  expect(control).toHaveBeenCalledWith({
    action: 'lookup',
    captureId: CAPTURE_ID,
    slot: 2,
    observationRevision: 1,
    nickname: '수동이름',
    serverId: 'siroco'
  })
  await act(async () => current.lookup(2, '수정이름', 'cain'))
  expect(control).toHaveBeenLastCalledWith({
    action: 'lookup',
    captureId: CAPTURE_ID,
    slot: 2,
    observationRevision: 2,
    nickname: '수정이름',
    serverId: 'cain'
  })
  expect(control.mock.calls.filter(([command]) => command.action === 'begin')).toHaveLength(1)
})

it('시작 응답을 기다리는 동안 같은 슬롯을 수정하면 최신 입력만 조회한다', async () => {
  const start = Promise.withResolvers<SearchCommandResult>()
  control.mockReturnValueOnce(start.promise)
  await act(async () => {
    current.lookup(0, '이전', 'cain')
    current.lookup(0, '최신', 'siroco')
  })
  await act(async () =>
    start.resolve({ ok: true, snapshot: searchSnapshot({ captureId: CAPTURE_ID, revision: 1 }) })
  )
  const lookups = control.mock.calls.filter(([command]) => command.action === 'lookup')
  expect(lookups).toEqual([
    [
      {
        action: 'lookup',
        captureId: CAPTURE_ID,
        slot: 0,
        observationRevision: 1,
        nickname: '최신',
        serverId: 'siroco'
      }
    ]
  ])
})

it('전체 재검색으로 초기화한 뒤 이전 시작 응답이 도착해도 조회하지 않는다', async () => {
  const start = Promise.withResolvers<SearchCommandResult>()
  control.mockReturnValueOnce(start.promise)
  await act(async () => current.lookup(0, '이전', 'cain'))
  await act(async () => current.reset())
  await act(async () =>
    start.resolve({ ok: true, snapshot: searchSnapshot({ captureId: CAPTURE_ID, revision: 1 }) })
  )
  expect(control.mock.calls.filter(([command]) => command.action === 'lookup')).toEqual([])
  expect(control).toHaveBeenCalledWith({ action: 'end', captureId: CAPTURE_ID })
})
