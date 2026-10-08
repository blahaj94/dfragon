import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { beforeEach, expect, it, vi, type Mock } from 'vitest'
import type { DesktopShortcut } from '../../preload/common/types/desktop-shortcut'
import { registerDesktopShortcuts } from './register'

const fixtures = vi.hoisted(() => ({
  create: vi.fn(),
  gameForeground: vi.fn(),
  appForeground: vi.fn()
}))
vi.mock('../lib/keyboard-shortcut', () => ({ createKeyboardShortcut: fixtures.create }))
vi.mock('../lib/win32-window-capture', () => ({
  isDnfForeground: fixtures.gameForeground,
  isCurrentProcessForeground: fixtures.appForeground
}))

const DOCUMENT_URL = 'file:///dfragon/index.html'
const VK_R = 0x52
const VK_SNAPSHOT = 0x2c

type TestFrame = { url: string; detached: boolean; isDestroyed: () => boolean; send: Mock }
type TestContents = EventEmitter & { mainFrame: TestFrame; isDestroyed: () => boolean }
function setup(): {
  frame: TestFrame
  contents: TestContents
  window: EventEmitter & { webContents: TestContents; isDestroyed: () => boolean }
  unregister: Mock
  onShortcut: Mock
  dispose: () => void
  dispatch: (action: DesktopShortcut) => void
  allowed: () => boolean
} {
  const frame = { url: DOCUMENT_URL, detached: false, isDestroyed: () => false, send: vi.fn() }
  const contents = Object.assign(new EventEmitter(), { mainFrame: frame, isDestroyed: () => false })
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: () => false
  })
  let listener: ((shortcut: DesktopShortcut) => void) | undefined
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
  const onShortcut = vi.fn()
  const dispose = registerDesktopShortcuts({
    window: window as unknown as BrowserWindow,
    rendererDocumentUrl: DOCUMENT_URL,
    onShortcut
  })

  return {
    frame,
    contents,
    window,
    unregister,
    onShortcut,
    dispose,
    dispatch: (action: DesktopShortcut) => listener!(action),
    allowed: () => foreground!()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  fixtures.gameForeground.mockReturnValue(false)
  fixtures.appForeground.mockReturnValue(false)
})

it('제품의 재검색과 업로드 모두 Alt 조합으로 등록한다', () => {
  const fixture = setup()
  expect(fixtures.create).toHaveBeenCalledWith({
    bindings: [
      { key: VK_R, alt: true, action: 'restart-search' },
      { key: VK_SNAPSHOT, alt: true, action: 'upload-capture', releaseOnly: true }
    ],
    isForeground: expect.any(Function)
  })
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
  fixture.dispatch('upload-capture')
  expect(fixture.onShortcut).not.toHaveBeenCalled()
  expect(fixture.frame.send).not.toHaveBeenCalled()
  fixture.dispose()
})

it('페이지 이동, renderer 종료와 창 닫기는 늦은 단축키 전달을 막는다', () => {
  const fixture = setup()
  fixtures.appForeground.mockReturnValue(true)
  fixture.dispatch('restart-search')
  expect(fixture.frame.send).toHaveBeenCalledExactlyOnceWith('desktopShortcut', 'restart-search')
  expect(fixture.onShortcut).toHaveBeenCalledExactlyOnceWith('restart-search')
  fixture.contents.emit('did-start-navigation', {}, 'file:///next.html', false, true)
  expect(fixture.allowed()).toBe(false)
  fixture.dispatch('upload-capture')
  expect(fixture.frame.send).toHaveBeenCalledTimes(1)
  fixture.contents.emit('did-navigate')
  expect(fixture.allowed()).toBe(true)
  fixture.contents.emit('render-process-gone')
  expect(fixture.allowed()).toBe(false)
  fixture.window.emit('closed')
  fixture.dispose()
  expect(fixture.unregister).toHaveBeenCalledTimes(1)
  expect(fixture.contents.listenerCount('did-start-navigation')).toBe(0)
  fixture.dispatch('upload-capture')
  expect(fixture.frame.send).toHaveBeenCalledTimes(1)
})
