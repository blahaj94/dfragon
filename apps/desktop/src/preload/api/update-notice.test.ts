import { beforeEach, expect, it, vi } from 'vitest'
import {
  dismissUpdateNotice,
  getUpdateNotice,
  onUpdateNoticeChanged,
  openUpdateRelease
} from './update-notice'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), on: vi.fn(), remove: vi.fn() }))
vi.mock('electron', () => ({
  ipcRenderer: { invoke: mocks.invoke, on: mocks.on, removeListener: mocks.remove }
}))

const snapshot = { revision: 3, notice: { tag: 'v0.0.4-beta.1', endsOcrCollection: true } }

beforeEach(() => vi.clearAllMocks())

it('조회와 닫기는 형식을 검증한 상태만 화면에 넘긴다', async () => {
  mocks.invoke.mockResolvedValue(snapshot)
  expect(await getUpdateNotice()).toEqual(snapshot)
  mocks.invoke.mockResolvedValue({ revision: 4, notice: null })
  expect(await dismissUpdateNotice('v0.0.4-beta.1')).toEqual({ revision: 4, notice: null })
  expect(mocks.invoke.mock.calls).toEqual([
    ['getUpdateNotice'],
    ['dismissUpdateNotice', 'v0.0.4-beta.1']
  ])

  for (const value of [
    { ...snapshot, raw: 'synthetic private payload' },
    { ...snapshot, revision: -1 },
    { ...snapshot, notice: { ...snapshot.notice, tag: 'https://example.test/' } },
    { ...snapshot, notice: { ...snapshot.notice, url: 'https://example.test/' } },
    { revision: 3 }
  ]) {
    mocks.invoke.mockResolvedValue(value)
    await expect(getUpdateNotice()).rejects.toThrow('INVALID_UPDATE_NOTICE_RESPONSE')
  }
})

it('Release tag 형식이 아닌 닫기, 열기 명령은 main에 보내지 않는다', async () => {
  mocks.invoke.mockResolvedValue(undefined)
  await openUpdateRelease('v0.0.4-beta.1')

  for (const tag of ['https://example.test/', 'v0.0.4/../x', '0.0.4']) {
    await expect(openUpdateRelease(tag)).rejects.toThrow('INVALID_UPDATE_NOTICE_COMMAND')
    await expect(dismissUpdateNotice(tag)).rejects.toThrow('INVALID_UPDATE_NOTICE_COMMAND')
  }
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('openUpdateRelease', 'v0.0.4-beta.1')
})

it('변경 알림은 형식을 검증한 상태만 전달하고 해제하면 같은 listener를 지운다', () => {
  const receive = vi.fn()
  const unsubscribe = onUpdateNoticeChanged(receive)
  const handler = mocks.on.mock.calls[0][1] as (event: unknown, value: unknown) => void

  handler({}, snapshot)
  handler({}, { ...snapshot, raw: 'synthetic private payload' })
  unsubscribe()

  expect(receive).toHaveBeenCalledExactlyOnceWith(snapshot)
  expect(mocks.on).toHaveBeenCalledWith('updateNoticeChanged', handler)
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('updateNoticeChanged', handler)
})
