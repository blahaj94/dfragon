import { EventEmitter } from 'node:events'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registerUpdateNoticeWindow } from './ipc-handler'
import { createUpdateNotices, type UpdateNotices } from './notices'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn(),
  openExternal: vi.fn()
}))
vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle, removeHandler: mocks.removeHandler },
  shell: { openExternal: mocks.openExternal }
}))

const documentUrl = 'file:///synthetic/index.html'
const RELEASE_PAGE = 'https://github.com/blahaj94/dfragon/releases/tag/'
type Handler = (event: unknown, ...args: unknown[]) => Promise<unknown>
type Frame = { url: string; detached: boolean; isDestroyed: () => boolean }
let notices: UpdateNotices
let dispose: (() => void) | undefined

beforeEach(async () => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  mocks.openExternal.mockResolvedValue(undefined)
  notices = createUpdateNotices({
    currentVersion: '0.0.2',
    readFeed: async () =>
      `<feed xmlns="http://www.w3.org/2005/Atom"><entry><link href="${RELEASE_PAGE}v0.0.3"/></entry></feed>`,
    onFailure: vi.fn()
  })
  notices.start()
  await vi.advanceTimersByTimeAsync(0)
})

afterEach(() => {
  dispose?.()
  notices.dispose()
  vi.useRealTimers()
})

function fixture(): {
  window: EventEmitter
  frame: Frame
  send: ReturnType<typeof vi.fn>
  onFailure: ReturnType<typeof vi.fn>
  event: IpcMainInvokeEvent
  invoke: (channel: string, event: unknown, ...args: unknown[]) => Promise<unknown>
} {
  const frame = { url: documentUrl, detached: false, isDestroyed: () => false }
  const send = vi.fn()
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    isDestroyed: () => false,
    send
  })
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: () => false
  })
  const onFailure = vi.fn()
  dispose = registerUpdateNoticeWindow({
    window: window as unknown as BrowserWindow,
    documentUrl,
    notices,
    onFailure
  })
  const handlers = new Map(
    mocks.handle.mock.calls.map(([channel, handler]) => [channel as string, handler as Handler])
  )
  const invoke = (channel: string, event: unknown, ...args: unknown[]): Promise<unknown> =>
    handlers.get(channel)!(event, ...args)
  const event = { sender: contents, senderFrame: frame } as unknown as IpcMainInvokeEvent

  return { window, frame, send, onFailure, event, invoke }
}

it.each([
  ['getUpdateNotice', []],
  ['dismissUpdateNotice', ['v0.0.3']],
  ['openUpdateRelease', ['v0.0.3']]
])(
  '신뢰하지 않은 화면의 %s 요청은 상태를 바꾸거나 Release를 열지 않는다',
  async (channel, args) => {
    const f = fixture()

    await expect(f.invoke(channel, { sender: {}, senderFrame: f.frame }, ...args)).rejects.toThrow(
      'UPDATE_NOTICE_NOT_ALLOWED'
    )
    f.frame.url = `${documentUrl}?other`
    await expect(f.invoke(channel, f.event, ...args)).rejects.toThrow('UPDATE_NOTICE_NOT_ALLOWED')

    expect(mocks.openExternal).not.toHaveBeenCalled()
    expect(notices.snapshot().notice?.tag).toBe('v0.0.3')
  }
)

it('지금 알리는 tag의 Release 페이지만 열고 다른 주소나 형식은 열지 않는다', async () => {
  const f = fixture()

  await f.invoke('openUpdateRelease', f.event, 'v0.0.3')
  expect(mocks.openExternal).toHaveBeenCalledExactlyOnceWith(`${RELEASE_PAGE}v0.0.3`)

  await f.invoke('openUpdateRelease', f.event, 'v0.0.4')
  for (const args of [
    ['https://example.test/'],
    ['v0.0.3/../../settings'],
    ['0.0.3'],
    [],
    ['v0.0.3', 'v0.0.3']
  ]) {
    await expect(f.invoke('openUpdateRelease', f.event, ...args)).rejects.toThrow(
      'INVALID_UPDATE_NOTICE_COMMAND'
    )
  }
  expect(mocks.openExternal).toHaveBeenCalledOnce()
})

it('Release를 열지 못하면 진단 코드만 남기고 화면에 실패를 돌려준다', async () => {
  const f = fixture()
  mocks.openExternal.mockRejectedValueOnce(new Error('synthetic shell failure'))

  await expect(f.invoke('openUpdateRelease', f.event, 'v0.0.3')).rejects.toThrow(
    'UPDATE_RELEASE_OPEN_FAILED'
  )
  expect(f.onFailure).toHaveBeenCalledExactlyOnceWith('UPDATE_RELEASE_OPEN_FAILED')
})

it('닫으면 결과 상태를 돌려주고 같은 상태를 신뢰한 화면에 보내며 닫은 Release는 열지 않는다', async () => {
  const f = fixture()

  expect(await f.invoke('getUpdateNotice', f.event)).toEqual({
    revision: 1,
    notice: { tag: 'v0.0.3', endsOcrCollection: false }
  })
  const dismissed = await f.invoke('dismissUpdateNotice', f.event, 'v0.0.3')

  expect(dismissed).toEqual({ revision: 2, notice: null })
  expect(f.send).toHaveBeenCalledExactlyOnceWith('updateNoticeChanged', dismissed)
  await f.invoke('openUpdateRelease', f.event, 'v0.0.3')
  expect(mocks.openExternal).not.toHaveBeenCalled()
})

it('창을 닫으면 handler와 알림 구독을 정리한다', async () => {
  // 앱 실행 동안 유지되는 알림 상태에 닫힌 창의 listener가 남지 않아야 한다.
  const unsubscribed = vi.fn()
  const subscribe = notices.subscribe
  vi.spyOn(notices, 'subscribe').mockImplementation((listener) => {
    const unsubscribe = subscribe(listener)

    return () => {
      unsubscribed()
      unsubscribe()
    }
  })
  const f = fixture()

  f.window.emit('closed')

  expect(mocks.removeHandler.mock.calls.map(([channel]) => channel).sort()).toEqual([
    'dismissUpdateNotice',
    'getUpdateNotice',
    'openUpdateRelease'
  ])
  expect(unsubscribed).toHaveBeenCalledOnce()
  notices.dismiss('v0.0.3')
  expect(f.send).not.toHaveBeenCalled()
})
