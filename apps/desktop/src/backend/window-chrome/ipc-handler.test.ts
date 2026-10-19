import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerWindowChromeWindow } from './ipc-handler'
import { WINDOW_CHROME_CHANNELS } from '@dfragon/desktop-contracts/types/window-chrome'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), remove: vi.fn(), workAreaHeight: 1040 }))
vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle, removeHandler: mocks.remove },
  screen: {
    getDisplayMatching: () => ({
      workArea: { x: 0, y: 0, width: 1920, height: mocks.workAreaHeight }
    })
  }
}))
const channels = [WINDOW_CHROME_CHANNELS.setTheme, WINDOW_CHROME_CHANNELS.setContentHeight]

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
  let contentSize = [1280, 800]
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: vi.fn(() => false),
    isMaximized: vi.fn(() => false),
    isFullScreen: vi.fn(() => false),
    setTitleBarOverlay: vi.fn(),
    setBackgroundColor: vi.fn(),
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: contentSize[0], height: contentSize[1] })),
    getContentSize: vi.fn(() => [...contentSize]),
    setContentSize: vi.fn((width: number, height: number) => {
      contentSize = [width, height]
    }),
    setMinimumSize: vi.fn()
  })
  const event = { sender: contents, senderFrame: frame }

  return { window, contents, frame, event }
}

function fixture(platform: NodeJS.Platform = 'win32') {
  const f = windowFixture()
  dispose = registerWindowChromeWindow({
    window: f.window as unknown as BrowserWindow,
    documentUrl,
    platform
  })
  const handler = (name: string) =>
    mocks.handle.mock.calls.find(([channel]) => channel === name)![1] as (
      event: unknown,
      ...args: unknown[]
    ) => Promise<void>

  return {
    ...f,
    setTheme: handler(WINDOW_CHROME_CHANNELS.setTheme),
    setContentHeight: handler(WINDOW_CHROME_CHANNELS.setContentHeight)
  }
}

it.each(['win32', 'linux'] as const)(
  '%s에서 라이트와 다크 창 색상을 적용한다',
  async (platform) => {
    const f = fixture(platform)
    await f.setTheme(f.event, 'light')
    await f.setTheme(f.event, 'dark')

    expect(f.window.setTitleBarOverlay.mock.calls).toEqual([
      [{ color: '#ffffff', symbolColor: '#1a1c20', height: 56 }],
      [{ color: '#121214', symbolColor: '#f1ede6', height: 56 }]
    ])
    expect(f.window.setBackgroundColor.mock.calls).toEqual([['#ffffff'], ['#121214']])
  }
)

it('macOS에서는 신호등 overlay를 바꾸지 않고 창 배경만 적용한다', async () => {
  const f = fixture('darwin')
  await f.setTheme(f.event, 'light')
  await f.setTheme(f.event, 'dark')

  expect(f.window.setTitleBarOverlay).not.toHaveBeenCalled()
  expect(f.window.setBackgroundColor.mock.calls).toEqual([['#ffffff'], ['#121214']])
})

it.each([
  'sender',
  'subframe',
  'nullFrame',
  'document',
  'detached',
  'destroyedFrame',
  'destroyedWindow',
  'destroyedContents'
])('%s에서 온 테마 변경은 부수 효과 전에 거부한다', async (kind) => {
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
  await expect(f.setTheme(event, 'dark')).rejects.toThrow('WINDOW_CHROME_NOT_ALLOWED')
  expect(f.window.setTitleBarOverlay).not.toHaveBeenCalled()
  expect(f.window.setBackgroundColor).not.toHaveBeenCalled()
})

it('호출할 때마다 현재 문서 URL을 다시 확인한다', async () => {
  const f = fixture()
  await f.setTheme(f.event, 'light')
  f.frame.url = 'https://synthetic.invalid/'

  await expect(f.setTheme(f.event, 'dark')).rejects.toThrow('WINDOW_CHROME_NOT_ALLOWED')
  expect(f.window.setTitleBarOverlay).toHaveBeenCalledExactlyOnceWith({
    color: '#ffffff',
    symbolColor: '#1a1c20',
    height: 56
  })
  expect(f.window.setBackgroundColor).toHaveBeenCalledExactlyOnceWith('#ffffff')
})

it.each([
  { name: '인자 없음', args: [] },
  { name: '인자 두 개', args: ['light', 'dark'] },
  { name: '알 수 없는 enum', args: ['system'] },
  { name: '대문자 enum', args: ['DARK'] },
  { name: '공백 포함 enum', args: [' light'] },
  { name: 'null', args: [null] },
  { name: 'undefined', args: [undefined] },
  { name: '숫자', args: [1] },
  { name: '배열', args: [['light']] }
])('$name 요청은 창 색상을 바꾸지 않는다', async ({ args }) => {
  const f = fixture()
  await expect(f.setTheme(f.event, ...args)).rejects.toThrow('INVALID_WINDOW_CHROME_COMMAND')
  expect(f.window.setTitleBarOverlay).not.toHaveBeenCalled()
  expect(f.window.setBackgroundColor).not.toHaveBeenCalled()
})

it('객체를 문자열로 변환해 테마로 허용하지 않는다', async () => {
  const f = fixture()
  const stringify = vi.fn(() => 'light')
  await expect(f.setTheme(f.event, { toString: stringify })).rejects.toThrow(
    'INVALID_WINDOW_CHROME_COMMAND'
  )
  expect(stringify).not.toHaveBeenCalled()
  expect(f.window.setTitleBarOverlay).not.toHaveBeenCalled()
  expect(f.window.setBackgroundColor).not.toHaveBeenCalled()
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
    expect(mocks.remove).toHaveBeenCalledTimes(2)
    await expect(f.setTheme(f.event, 'dark')).rejects.toThrow('WINDOW_CHROME_NOT_ALLOWED')
    await expect(f.setContentHeight(f.event, 400)).rejects.toThrow('WINDOW_CHROME_NOT_ALLOWED')
    expect(f.window.setTitleBarOverlay).not.toHaveBeenCalled()
    expect(f.window.setBackgroundColor).not.toHaveBeenCalled()
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

it('두 번째 handler 등록 실패 시 등록한 첫 handler만 제거한다', () => {
  const f = windowFixture()
  const failure = new Error('Synthetic second handler registration failure')
  mocks.handle
    .mockImplementationOnce(() => {})
    .mockImplementationOnce(() => {
      throw failure
    })

  expect(() =>
    registerWindowChromeWindow({ window: f.window as unknown as BrowserWindow, documentUrl })
  ).toThrow(failure)
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(WINDOW_CHROME_CHANNELS.setTheme)
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
  it('접을 때는 최소 높이를 먼저 접은 높이로 낮춘 뒤 내용 높이를 400으로 줄인다', async () => {
    const f = fixture()
    await f.setContentHeight(f.event, 400)

    expect(f.window.setMinimumSize).toHaveBeenCalledExactlyOnceWith(1024, 400)
    expect(f.window.setContentSize).toHaveBeenCalledExactlyOnceWith(1280, 400)
    expect(f.window.setMinimumSize.mock.invocationCallOrder[0]).toBeLessThan(
      f.window.setContentSize.mock.invocationCallOrder[0]
    )
  })

  it('펼칠 때는 내용 높이를 800으로 늘린 뒤 최소 높이를 640으로 되돌린다', async () => {
    const f = fixture()
    await f.setContentHeight(f.event, 400)
    vi.clearAllMocks()
    await f.setContentHeight(f.event, 800)

    expect(f.window.setContentSize).toHaveBeenCalledExactlyOnceWith(1280, 800)
    expect(f.window.setMinimumSize).toHaveBeenCalledExactlyOnceWith(1024, 640)
    expect(f.window.setContentSize.mock.invocationCallOrder[0]).toBeLessThan(
      f.window.setMinimumSize.mock.invocationCallOrder[0]
    )
  })

  it('공대를 접은 높이 560도 받고, 파티의 접은 높이 400에서 늘릴 때는 높이를 바꾼 뒤 최소 높이를 맞춘다', async () => {
    const f = fixture()
    await f.setContentHeight(f.event, 560)

    expect(f.window.setMinimumSize).toHaveBeenCalledExactlyOnceWith(1024, 560)
    expect(f.window.setContentSize).toHaveBeenCalledExactlyOnceWith(1280, 560)

    await f.setContentHeight(f.event, 400)
    vi.clearAllMocks()
    await f.setContentHeight(f.event, 560)

    expect(f.window.setContentSize).toHaveBeenCalledExactlyOnceWith(1280, 560)
    expect(f.window.setMinimumSize).toHaveBeenCalledExactlyOnceWith(1024, 560)
    expect(f.window.setContentSize.mock.invocationCallOrder[0]).toBeLessThan(
      f.window.setMinimumSize.mock.invocationCallOrder[0]
    )
  })

  it('창이 놓인 화면의 작업 영역보다 높게 늘리지 않는다', async () => {
    mocks.workAreaHeight = 728
    const f = fixture()
    await f.setContentHeight(f.event, 400)
    await f.setContentHeight(f.event, 800)

    expect(f.window.setContentSize).toHaveBeenLastCalledWith(1280, 728)
    expect(f.window.setMinimumSize).toHaveBeenLastCalledWith(1024, 640)
  })

  it.each(['isMaximized', 'isFullScreen'] as const)(
    '%s 상태에서는 창 크기와 최소 크기를 바꾸지 않는다',
    async (state) => {
      const f = fixture()
      f.window[state].mockReturnValue(true)
      await expect(f.setContentHeight(f.event, 400)).resolves.toBeUndefined()

      expect(f.window.setContentSize).not.toHaveBeenCalled()
      expect(f.window.setMinimumSize).not.toHaveBeenCalled()
    }
  )

  it.each([
    { name: '인자 없음', args: [] },
    { name: '인자 두 개', args: [400, 800] },
    { name: '접은 높이보다 작음', args: [399] },
    { name: '기준 높이보다 큼', args: [801] },
    { name: '소수', args: [400.5] },
    { name: 'NaN', args: [Number.NaN] },
    { name: 'Infinity', args: [Number.POSITIVE_INFINITY] },
    { name: '숫자 문자열', args: ['400'] },
    { name: 'null', args: [null] },
    { name: '배열', args: [[400]] }
  ])('$name 요청은 창 크기를 바꾸지 않는다', async ({ args }) => {
    const f = fixture()
    await expect(f.setContentHeight(f.event, ...args)).rejects.toThrow(
      'INVALID_WINDOW_CHROME_COMMAND'
    )
    expect(f.window.setContentSize).not.toHaveBeenCalled()
    expect(f.window.setMinimumSize).not.toHaveBeenCalled()
  })

  it('객체를 숫자로 변환해 높이로 허용하지 않는다', async () => {
    const f = fixture()
    const toNumber = vi.fn(() => 400)
    await expect(f.setContentHeight(f.event, { valueOf: toNumber })).rejects.toThrow(
      'INVALID_WINDOW_CHROME_COMMAND'
    )
    expect(toNumber).not.toHaveBeenCalled()
    expect(f.window.setContentSize).not.toHaveBeenCalled()
  })

  it.each(['sender', 'subframe', 'document', 'detached', 'destroyedWindow'])(
    '%s에서 온 높이 변경은 부수 효과 전에 거부한다',
    async (kind) => {
      const f = fixture()
      const event: { sender: unknown; senderFrame: unknown } = { ...f.event }
      if (kind === 'sender') {
        event.sender = {}
      }

      if (kind === 'subframe') {
        event.senderFrame = {}
      }

      if (kind === 'document') {
        f.frame.url = `${documentUrl}?unexpected`
      }

      if (kind === 'detached') {
        f.frame.detached = true
      }

      if (kind === 'destroyedWindow') {
        f.window.isDestroyed.mockReturnValue(true)
      }
      await expect(f.setContentHeight(event, 400)).rejects.toThrow('WINDOW_CHROME_NOT_ALLOWED')
      expect(f.window.setContentSize).not.toHaveBeenCalled()
      expect(f.window.setMinimumSize).not.toHaveBeenCalled()
    }
  )
})
