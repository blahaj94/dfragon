import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { beforeEach, expect, it, vi, type Mock } from 'vitest'
import { registerDesktopShortcuts } from './register'

const fixtures = vi.hoisted(() => ({
  create: vi.fn(),
  gameForeground: vi.fn(),
  appForeground: vi.fn()
}))
vi.mock('../lib/keyboard-shortcut', () => ({ createAltKeyShortcut: fixtures.create }))
vi.mock('../lib/win32-window-capture', () => ({
  isDnfForeground: fixtures.gameForeground,
  isCurrentProcessForeground: fixtures.appForeground
}))

const DOCUMENT_URL = 'file:///dfragon/index.html'
const VK_A = 0x41
const VK_R = 0x52
const VK_W = 0x57

type TestFrame = { url: string; detached: boolean; isDestroyed: () => boolean; send: Mock }
type TestContents = EventEmitter & { mainFrame: TestFrame; isDestroyed: () => boolean }
function setup(): {
  frame: TestFrame
  contents: TestContents
  window: EventEmitter & { webContents: TestContents; isDestroyed: () => boolean }
  unregister: Mock
  dispose: () => void
  dispatch: (key?: number) => void
  allowed: () => boolean
} {
  const frame = { url: DOCUMENT_URL, detached: false, isDestroyed: () => false, send: vi.fn() }
  const contents = Object.assign(new EventEmitter(), { mainFrame: frame, isDestroyed: () => false })
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: () => false
  })
  let listener: ((key: number) => void) | undefined
  let foreground: (() => boolean) | undefined
  const unregister = vi.fn()
  fixtures.create.mockImplementation((options) => {
    foreground = options.isForeground

    return {
      register: (next: typeof listener) => {
        listener = next

        return true
      },
      unregister
    }
  })
  const dispose = registerDesktopShortcuts({
    window: window as unknown as BrowserWindow,
    rendererDocumentUrl: DOCUMENT_URL
  })

  return {
    frame,
    contents,
    window,
    unregister,
    dispose,
    dispatch: (key = VK_R) => listener!(key),
    allowed: () => foreground!()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  fixtures.gameForeground.mockReturnValue(false)
  fixtures.appForeground.mockReturnValue(false)
})

it('Alt+R 재검색, Alt+W 스냅샷, Alt+A 클립보드 복사를 한 hook으로 등록한다', () => {
  const fixture = setup()
  expect(fixtures.create).toHaveBeenCalledExactlyOnceWith({
    keys: expect.arrayContaining([VK_R, VK_W, VK_A]),
    isForeground: expect.any(Function)
  })
  expect(fixtures.create.mock.calls[0][0].keys).toHaveLength(3)
  fixture.dispose()
})

it('눌린 키에 맞는 단축키 이름을 현재 main document에 보낸다', () => {
  const fixture = setup()
  fixture.dispatch(VK_W)
  fixture.dispatch(VK_A)
  fixture.dispatch(VK_R)
  expect(fixture.frame.send.mock.calls).toEqual([
    ['desktopShortcut', 'take-snapshot'],
    ['desktopShortcut', 'copy-clipboard'],
    ['desktopShortcut', 'restart-search']
  ])
  fixture.dispose()
})

it('허용 앱과 현재 main document가 모두 맞아야 키를 처리한다', () => {
  const fixture = setup()
  expect(fixture.allowed()).toBe(false)
  fixtures.gameForeground.mockReturnValue(true)
  expect(fixture.allowed()).toBe(true)
  fixtures.gameForeground.mockReturnValue(false)
  fixtures.appForeground.mockReturnValue(true)
  expect(fixture.allowed()).toBe(true)
  fixture.frame.url = 'https://untrusted.example/'
  expect(fixture.allowed()).toBe(false)
  fixture.dispatch()
  expect(fixture.frame.send).not.toHaveBeenCalled()
  fixture.dispose()
})

it('페이지 이동, renderer 종료와 창 닫기는 늦은 단축키 전달을 막는다', () => {
  const fixture = setup()
  fixtures.appForeground.mockReturnValue(true)
  fixture.dispatch()
  expect(fixture.frame.send).toHaveBeenCalledExactlyOnceWith('desktopShortcut', 'restart-search')
  fixture.contents.emit('did-start-navigation', {}, 'file:///next.html', false, true)
  expect(fixture.allowed()).toBe(false)
  fixture.dispatch()
  expect(fixture.frame.send).toHaveBeenCalledTimes(1)
  fixture.contents.emit('did-navigate')
  expect(fixture.allowed()).toBe(true)
  fixture.contents.emit('render-process-gone')
  expect(fixture.allowed()).toBe(false)
  fixture.window.emit('closed')
  fixture.dispose()
  expect(fixture.unregister).toHaveBeenCalledTimes(1)
  expect(fixture.contents.listenerCount('did-start-navigation')).toBe(0)
  fixture.dispatch()
  expect(fixture.frame.send).toHaveBeenCalledTimes(1)
})
