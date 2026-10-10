import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registerWindowChromeWindow } from './ipc-handler'
import { WINDOW_CHROME_CHANNELS } from '../../preload/common/types/window-chrome'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), remove: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle: mocks.handle, removeHandler: mocks.remove } }))

const documentUrl = 'file:///synthetic/index.html'
let dispose: (() => void) | undefined
beforeEach(() => {
  vi.clearAllMocks()
  dispose = undefined
})
afterEach(() => dispose?.())

function windowFixture() {
  const frame = { url: documentUrl, detached: false, isDestroyed: vi.fn(() => false) }
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    isDestroyed: vi.fn(() => false)
  })
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: vi.fn(() => false),
    setTitleBarOverlay: vi.fn(),
    setBackgroundColor: vi.fn()
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
  const setTheme = mocks.handle.mock.calls.find(
    ([channel]) => channel === WINDOW_CHROME_CHANNELS.setTheme
  )![1] as (event: unknown, ...args: unknown[]) => Promise<void>

  return { ...f, setTheme }
}

it.each(['win32', 'linux'] as const)(
  '%s에서 라이트와 다크 창 색상을 적용한다',
  async (platform) => {
    const f = fixture(platform)
    await f.setTheme(f.event, 'light')
    await f.setTheme(f.event, 'dark')

    expect(f.window.setTitleBarOverlay.mock.calls).toEqual([
      [{ color: '#ffffff', symbolColor: '#1a1c20', height: 56 }],
      [{ color: '#1d2025', symbolColor: '#f3f4f5', height: 56 }]
    ])
    expect(f.window.setBackgroundColor.mock.calls).toEqual([['#ffffff'], ['#1d2025']])
  }
)

it('macOS에서는 신호등 overlay를 바꾸지 않고 창 배경만 적용한다', async () => {
  const f = fixture('darwin')
  await f.setTheme(f.event, 'light')
  await f.setTheme(f.event, 'dark')

  expect(f.window.setTitleBarOverlay).not.toHaveBeenCalled()
  expect(f.window.setBackgroundColor.mock.calls).toEqual([['#ffffff'], ['#1d2025']])
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

    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(WINDOW_CHROME_CHANNELS.setTheme)
    expect(f.window.listenerCount('closed')).toBe(0)
    expect(f.contents.listenerCount('destroyed')).toBe(0)
    dispose?.()
    dispose?.()
    expect(mocks.remove).toHaveBeenCalledTimes(1)
    await expect(f.setTheme(f.event, 'dark')).rejects.toThrow('WINDOW_CHROME_NOT_ALLOWED')
    expect(f.window.setTitleBarOverlay).not.toHaveBeenCalled()
    expect(f.window.setBackgroundColor).not.toHaveBeenCalled()
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
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(WINDOW_CHROME_CHANNELS.setTheme)
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
