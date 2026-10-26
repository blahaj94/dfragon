import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerWindowChromeWindow } from './ipc-handler'
import { WINDOW_CHROME_CHANNELS } from '../../preload/common/types/window-chrome'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), remove: vi.fn(), workAreaHeight: 1040 }))
vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle, removeHandler: mocks.remove },
  screen: {
    getDisplayMatching: () => ({
      workArea: { x: 0, y: 0, width: 1920, height: mocks.workAreaHeight }
    })
  }
}))
const channels = [WINDOW_CHROME_CHANNELS.setContentHeight]

const documentUrl = 'file:///synthetic/index.html'
let dispose: (() => void) | undefined
beforeEach(() => {
  vi.clearAllMocks()
  mocks.workAreaHeight = 1040
  dispose = undefined
})
afterEach(() => dispose?.())

function windowFixture() {
  const frame = { url: documentUrl, detached: false, isDestroyed: vi.fn(() => false) }
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    isDestroyed: vi.fn(() => false)
  })
  let contentSize = [1280, 163]
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: vi.fn(() => false),
    isMaximized: vi.fn(() => false),
    isFullScreen: vi.fn(() => false),
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: contentSize[0], height: contentSize[1] })),
    getContentSize: vi.fn(() => [...contentSize]),
    setContentSize: vi.fn((width: number, height: number) => {
      contentSize = [width, height]
    })
  })
  const event = { sender: contents, senderFrame: frame }

  return { window, contents, frame, event }
}

function fixture() {
  const f = windowFixture()
  dispose = registerWindowChromeWindow({
    window: f.window as unknown as BrowserWindow,
    documentUrl
  })
  const handler = (name: string) =>
    mocks.handle.mock.calls.find(([channel]) => channel === name)![1] as (
      event: unknown,
      ...args: unknown[]
    ) => Promise<void>

  return {
    ...f,
    setContentHeight: handler(WINDOW_CHROME_CHANNELS.setContentHeight)
  }
}

it.each([
  'sender',
  'subframe',
  'nullFrame',
  'document',
  'detached',
  'destroyedFrame',
  'destroyedWindow',
  'destroyedContents'
])('%s에서 온 높이 변경은 부수 효과 전에 거부한다', async (kind) => {
  const f = fixture()
  const event: { sender: unknown; senderFrame: unknown } = { ...f.event }
  if (kind === 'sender') {
    event.sender = {}
  }

  if (kind === 'subframe') {
    event.senderFrame = {}
  }

  if (kind === 'nullFrame') {
    event.senderFrame = null
  }

  if (kind === 'document') {
    f.frame.url = `${documentUrl}?unexpected`
  }

  if (kind === 'detached') {
    f.frame.detached = true
  }

  if (kind === 'destroyedFrame') {
    f.frame.isDestroyed.mockReturnValue(true)
  }

  if (kind === 'destroyedWindow') {
    f.window.isDestroyed.mockReturnValue(true)
  }

  if (kind === 'destroyedContents') {
    f.contents.isDestroyed.mockReturnValue(true)
  }
  await expect(f.setContentHeight(event, 300)).rejects.toThrow('WINDOW_CHROME_NOT_ALLOWED')
  expect(f.window.setContentSize).not.toHaveBeenCalled()
})

it('호출할 때마다 현재 문서 URL을 다시 확인한다', async () => {
  const f = fixture()
  await f.setContentHeight(f.event, 300)
  f.frame.url = 'https://synthetic.invalid/'

  await expect(f.setContentHeight(f.event, 163)).rejects.toThrow('WINDOW_CHROME_NOT_ALLOWED')
  expect(f.window.setContentSize).toHaveBeenCalledExactlyOnceWith(1280, 300)
})

it.each(['closed', 'destroyed', 'dispose'] as const)(
  '%s 뒤 handler와 listener를 제거하고 반복 dispose도 안전하다',
  async (kind) => {
    const f = fixture()
    expect(f.window.listenerCount('closed')).toBe(1)
    expect(f.contents.listenerCount('destroyed')).toBe(1)
    if (kind === 'closed') {
      f.window.emit('closed')
    }

    if (kind === 'destroyed') {
      f.contents.emit('destroyed')
    }

    if (kind === 'dispose') {
      dispose?.()
    }

    expect(mocks.remove.mock.calls).toEqual(channels.map((channel) => [channel]))
    expect(f.window.listenerCount('closed')).toBe(0)
    expect(f.contents.listenerCount('destroyed')).toBe(0)
    dispose?.()
    dispose?.()
    expect(mocks.remove).toHaveBeenCalledTimes(channels.length)
    await expect(f.setContentHeight(f.event, 300)).rejects.toThrow('WINDOW_CHROME_NOT_ALLOWED')
    expect(f.window.setContentSize).not.toHaveBeenCalled()
  }
)

it('listener 등록 실패 시 이미 등록한 handler와 listener를 정리하고 오류를 전달한다', () => {
  const f = windowFixture()
  const failure = new Error('Synthetic listener registration failure')
  vi.spyOn(f.window, 'on').mockImplementationOnce(() => {
    throw failure
  })

  expect(() =>
    registerWindowChromeWindow({ window: f.window as unknown as BrowserWindow, documentUrl })
  ).toThrow(failure)
  expect(mocks.remove.mock.calls).toEqual(channels.map((channel) => [channel]))
  expect(f.contents.listenerCount('destroyed')).toBe(0)
  expect(f.window.listenerCount('closed')).toBe(0)
})

it('handler 등록 실패 시 기존 handler를 제거하지 않는다', () => {
  const f = windowFixture()
  const failure = new Error('Synthetic handler registration failure')
  mocks.handle.mockImplementationOnce(() => {
    throw failure
  })

  expect(() =>
    registerWindowChromeWindow({ window: f.window as unknown as BrowserWindow, documentUrl })
  ).toThrow(failure)
  expect(mocks.remove).not.toHaveBeenCalled()
  expect(f.contents.listenerCount('destroyed')).toBe(0)
  expect(f.window.listenerCount('closed')).toBe(0)
})

describe('창 내용 높이', () => {
  it('공대 화면 높이 300으로 늘리고 파티 화면 높이 163으로 줄이며 폭은 그대로 둔다', async () => {
    const f = fixture()
    await f.setContentHeight(f.event, 300)
    expect(f.window.setContentSize).toHaveBeenLastCalledWith(1280, 300)

    await f.setContentHeight(f.event, 163)
    expect(f.window.setContentSize).toHaveBeenLastCalledWith(1280, 163)
  })

  it('사용자가 바꾼 폭은 유지하고, 키운 높이는 요청한 화면 높이로 맞춘다', async () => {
    const f = fixture()
    f.window.setContentSize(1600, 520)
    vi.clearAllMocks()
    await f.setContentHeight(f.event, 300)

    expect(f.window.setContentSize).toHaveBeenCalledExactlyOnceWith(1600, 300)
  })

  it('창이 놓인 화면의 작업 영역보다 높게 늘리지 않는다', async () => {
    mocks.workAreaHeight = 240
    const f = fixture()
    await f.setContentHeight(f.event, 300)

    expect(f.window.setContentSize).toHaveBeenCalledExactlyOnceWith(1280, 240)
  })

  it.each(['isMaximized', 'isFullScreen'] as const)(
    '%s 상태에서는 창 크기를 바꾸지 않는다',
    async (state) => {
      const f = fixture()
      f.window[state].mockReturnValue(true)
      await expect(f.setContentHeight(f.event, 300)).resolves.toBeUndefined()

      expect(f.window.setContentSize).not.toHaveBeenCalled()
    }
  )

  it.each([
    { name: '인자 없음', args: [] },
    { name: '인자 두 개', args: [163, 300] },
    { name: '파티 높이보다 작음', args: [162] },
    { name: '공대 높이보다 큼', args: [301] },
    { name: '이전 기준 높이', args: [800] },
    { name: '소수', args: [163.5] },
    { name: 'NaN', args: [Number.NaN] },
    { name: 'Infinity', args: [Number.POSITIVE_INFINITY] },
    { name: '숫자 문자열', args: ['163'] },
    { name: 'null', args: [null] },
    { name: '배열', args: [[163]] }
  ])('$name 요청은 창 크기를 바꾸지 않는다', async ({ args }) => {
    const f = fixture()
    await expect(f.setContentHeight(f.event, ...args)).rejects.toThrow(
      'INVALID_WINDOW_CHROME_COMMAND'
    )
    expect(f.window.setContentSize).not.toHaveBeenCalled()
  })

  it('객체를 숫자로 변환해 높이로 허용하지 않는다', async () => {
    const f = fixture()
    const toNumber = vi.fn(() => 163)
    await expect(f.setContentHeight(f.event, { valueOf: toNumber })).rejects.toThrow(
      'INVALID_WINDOW_CHROME_COMMAND'
    )
    expect(toNumber).not.toHaveBeenCalled()
    expect(f.window.setContentSize).not.toHaveBeenCalled()
  })
})
