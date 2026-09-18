import { afterEach, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type {
  SearchApi,
  SearchCommandResult,
  SearchSnapshot
} from '../../../preload/common/types/search'
import { CAPTURE_ID, searchSnapshot } from '../../../preload/api/search-test-fixture'
import { SearchConnection } from './search-connection'

const connections: SearchConnection[] = []
afterEach(() => connections.splice(0).forEach((connection) => connection.dispose()))

/** 실제 연결의 구독·명령 응답 순서를 개별적으로 제어한다. */
function fixture(): {
  connection: SearchConnection
  control: Mock<SearchApi['controlCharacterSearch']>
  listeners: Array<(snapshot: SearchSnapshot) => void>
  unsubscribes: Mock[]
  onSnapshot: Mock
  onFailure: Mock
  onRunChanged: Mock
} {
  const listeners: Array<(snapshot: SearchSnapshot) => void> = []
  const unsubscribes: Mock[] = []
  const control = vi.fn<SearchApi['controlCharacterSearch']>().mockResolvedValue({
    ok: true,
    snapshot: searchSnapshot({ captureId: null })
  })
  const onSnapshot = vi.fn()
  const onFailure = vi.fn()
  const onRunChanged = vi.fn()
  const connection = new SearchConnection({
    api: {
      controlCharacterSearch: control,
      onCharacterSearchChanged: (listener) => {
        listeners.push(listener)
        const unsubscribe = vi.fn()
        unsubscribes.push(unsubscribe)
        return unsubscribe
      }
    },
    onSnapshot,
    onFailure,
    onRunChanged
  })
  connections.push(connection)
  return { connection, control, listeners, unsubscribes, onSnapshot, onFailure, onRunChanged }
}

it('초기 조회 전 event 중 최신 revision만 조회 뒤 반영한다', async () => {
  const f = fixture()
  const read = Promise.withResolvers<SearchCommandResult>()
  f.control.mockReturnValueOnce(read.promise)
  f.connection.connect()
  f.listeners[0](searchSnapshot({ revision: 5 }))
  f.listeners[0](searchSnapshot({ revision: 4 }))
  expect(f.connection.ready).toBe(false)
  expect(f.onSnapshot).toHaveBeenCalledExactlyOnceWith(null)

  read.resolve({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })
  await vi.waitFor(() => expect(f.connection.ready).toBe(true))
  expect(f.onSnapshot).toHaveBeenLastCalledWith(searchSnapshot({ revision: 5 }))
})

it('run 변경은 이전 구독을 해제하고 이전 명령 응답을 새 연결에 반영하지 않는다', async () => {
  const f = fixture()
  f.connection.connect()
  await vi.waitFor(() => expect(f.connection.ready).toBe(true))
  const begin = Promise.withResolvers<SearchCommandResult>()
  f.control.mockReturnValueOnce(begin.promise)
  const command = f.connection.command({ action: 'begin' })
  const next = searchSnapshot({ runId: '00000000-0000-4000-8000-000000000099', captureId: null })
  f.control.mockResolvedValueOnce({ ok: true, snapshot: next })
  f.listeners[0](next)
  await vi.waitFor(() => expect(f.onSnapshot).toHaveBeenLastCalledWith(next))
  expect(f.onRunChanged).toHaveBeenCalledOnce()
  expect(f.unsubscribes[0]).toHaveBeenCalledOnce()

  f.onSnapshot.mockClear()
  f.listeners[0](searchSnapshot({ revision: 99 }))
  const direct = { ok: true, snapshot: searchSnapshot() } as const
  begin.resolve(direct)
  expect(await command).toEqual(direct)
  expect(f.onSnapshot).not.toHaveBeenCalled()
  expect(f.onRunChanged).toHaveBeenCalledOnce()
})

it.each(['success', 'failure'] as const)(
  '재연결 뒤 이전 복구 조회의 %s는 새 상태를 바꾸지 않는다',
  async (outcome) => {
    const f = fixture()
    f.connection.connect()
    await vi.waitFor(() => expect(f.connection.ready).toBe(true))
    const recovery = Promise.withResolvers<SearchCommandResult>()
    f.control
      .mockRejectedValueOnce(new Error('Synthetic response loss'))
      .mockReturnValueOnce(recovery.promise)
    const command = f.connection.command({ action: 'begin' })
    await vi.waitFor(() => expect(f.control).toHaveBeenCalledTimes(3))
    f.connection.connect()
    await vi.waitFor(() => expect(f.connection.ready).toBe(true))
    f.onSnapshot.mockClear()
    if (outcome === 'success') {
      recovery.resolve({ ok: true, snapshot: searchSnapshot({ revision: 99 }) })
    } else {
      recovery.reject(new Error('Synthetic stale read failure'))
    }
    expect(await command).toBeNull()
    expect(f.onSnapshot).not.toHaveBeenCalled()
    expect(f.onFailure).not.toHaveBeenCalled()
    expect(f.connection.ready).toBe(true)
  }
)

it('슬롯별 명령을 동시에 보내고 역순 응답에도 최신 snapshot을 유지한다', async () => {
  const f = fixture()
  f.connection.connect()
  await vi.waitFor(() => expect(f.connection.ready).toBe(true))
  const first = Promise.withResolvers<SearchCommandResult>()
  const second = Promise.withResolvers<SearchCommandResult>()
  const sendFirst = vi.fn(() => first.promise)
  const sendSecond = vi.fn(() => second.promise)
  const one = f.connection.invoke(sendFirst)
  const two = f.connection.invoke(sendSecond)
  expect(sendFirst).toHaveBeenCalledOnce()
  expect(sendSecond).toHaveBeenCalledOnce()

  second.resolve({ ok: true, snapshot: searchSnapshot({ revision: 3 }) })
  await two
  first.resolve({ ok: true, snapshot: searchSnapshot({ revision: 2 }) })
  await one
  expect(f.onSnapshot).toHaveBeenLastCalledWith(searchSnapshot({ revision: 3 }))
})

it('복구 조회 실패 뒤 event는 표시하되 조회 성공 전에는 새 시작을 허용하지 않는다', async () => {
  const f = fixture()
  f.connection.connect()
  await vi.waitFor(() => expect(f.connection.ready).toBe(true))
  for (let revision = 2; revision <= 3; revision += 1) {
    f.control
      .mockRejectedValueOnce(new Error('Synthetic command loss'))
      .mockRejectedValueOnce(new Error('Synthetic read loss'))
    expect(await f.connection.command({ action: 'end', captureId: CAPTURE_ID })).toBeNull()
    expect(f.onFailure).toHaveBeenCalledTimes(revision - 1)
    expect(f.onSnapshot).toHaveBeenLastCalledWith(null)
    f.listeners[0](searchSnapshot({ revision }))
    expect(f.onSnapshot).toHaveBeenLastCalledWith(searchSnapshot({ revision }))
    expect(f.connection.ready).toBe(false)
  }
  f.control
    .mockRejectedValueOnce(new Error('Synthetic command loss'))
    .mockResolvedValueOnce({ ok: true, snapshot: searchSnapshot({ revision: 4 }) })
  expect(await f.connection.command({ action: 'end', captureId: CAPTURE_ID })).toBeNull()
  expect(f.connection.ready).toBe(true)
})

it('dispose 뒤 늦은 begin의 직접 응답과 end 전송은 보존하되 표시·복구 조회는 하지 않는다', async () => {
  const f = fixture()
  f.connection.connect()
  await vi.waitFor(() => expect(f.connection.ready).toBe(true))
  const begin = Promise.withResolvers<SearchCommandResult>()
  f.control.mockReturnValueOnce(begin.promise)
  const command = f.connection.command({ action: 'begin' })
  f.connection.dispose()
  f.onSnapshot.mockClear()
  begin.resolve({ ok: true, snapshot: searchSnapshot() })
  const result = await command
  expect(result?.snapshot.captureId).toBe(CAPTURE_ID)
  f.control.mockRejectedValueOnce(new Error('Synthetic cleanup loss'))
  await f.connection.command({ action: 'end', captureId: CAPTURE_ID })
  expect(f.control).toHaveBeenCalledTimes(3)
  expect(f.control).toHaveBeenLastCalledWith({ action: 'end', captureId: CAPTURE_ID })
  expect(f.onSnapshot).not.toHaveBeenCalled()
  expect(f.onFailure).not.toHaveBeenCalled()
  expect(f.unsubscribes[0]).toHaveBeenCalledOnce()
  expect(f.connection.ready).toBe(false)
})
