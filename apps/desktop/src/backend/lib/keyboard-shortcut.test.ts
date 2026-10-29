import { afterEach, expect, it, vi, type Mock } from 'vitest'
import { createAltKeyShortcut } from './keyboard-shortcut'
import {
  createWin32KeyboardHook,
  type KeyboardModifiers,
  type Win32KeyboardApi
} from './win32-keyboard-hook'

const KEY_DOWN = 0x100
const KEY_UP = 0x101
const SYSTEM_KEY_DOWN = 0x104
const SYSTEM_KEY_UP = 0x105
const VK_R = 0x52
const VK_SNAPSHOT = 0x2c
const NO_MODIFIERS = { shift: false, control: false, alt: false, windows: false }
const SHIFT = { ...NO_MODIFIERS, shift: true }
const ALT = { ...NO_MODIFIERS, alt: true }

function setup(): {
  api: Win32KeyboardApi
  hook: ReturnType<typeof createWin32KeyboardHook>
  shortcut: ReturnType<typeof createAltKeyShortcut>
  listener: Mock
  isForeground: Mock<() => boolean>
  key: (message: number, code?: number, modifiers?: KeyboardModifiers) => number | bigint
} {
  let callback: Parameters<Win32KeyboardApi['registerCallback']>[0] | undefined
  let keyCode = VK_R
  let modifiers = ALT
  const api: Win32KeyboardApi = {
    registerCallback: vi.fn((handler) => {
      callback = handler

      return 1n
    }),
    releaseCallback: vi.fn(),
    installHook: vi.fn(() => 2n),
    removeHook: vi.fn(() => true),
    callNext: vi.fn(() => 77n),
    readVirtualKey: () => keyCode,
    readModifiers: () => modifiers
  }
  const hook = createWin32KeyboardHook({ platform: 'win32', loadNativeApi: () => api })
  const isForeground = vi.fn(() => true)
  const shortcut = createAltKeyShortcut({ key: VK_R, isForeground, hook })
  const listener = vi.fn()
  shortcut.register(listener)
  function key(
    message: number,
    code = VK_R,
    nextModifiers: KeyboardModifiers = ALT
  ): number | bigint {
    keyCode = code
    modifiers = nextModifiers

    return callback!(0, message, 3n)
  }

  return { api, hook, shortcut, listener, isForeground, key }
}

afterEach(() => vi.useRealTimers())

it.each([
  { input: '일반 키 메시지', down: KEY_DOWN, up: KEY_UP },
  { input: 'Alt 시스템 키 메시지', down: SYSTEM_KEY_DOWN, up: SYSTEM_KEY_UP }
])('$input에서 Alt+R은 한 번만 실행하고 다른 키와 조합은 넘긴다', ({ down, up }) => {
  vi.useFakeTimers()
  const { shortcut, listener, key } = setup()
  expect(key(down)).toBe(1)
  expect(key(down)).toBe(1)
  expect(key(up)).toBe(1)
  expect(key(up)).toBe(77n)
  vi.runAllTimers()
  expect(listener).toHaveBeenCalledTimes(1)
  expect(key(down, VK_SNAPSHOT)).toBe(77n)
  expect(key(up, VK_SNAPSHOT)).toBe(77n)
  for (const modifiers of [
    NO_MODIFIERS,
    SHIFT,
    { ...ALT, control: true },
    { ...ALT, shift: true },
    { ...ALT, windows: true }
  ]) {
    expect(key(down, VK_R, modifiers)).toBe(77n)
    expect(key(up, VK_R, modifiers)).toBe(77n)
  }
  vi.runAllTimers()
  expect(listener).toHaveBeenCalledTimes(1)
  shortcut.unregister()
})

it('대문자 R과 두벌식 ㄲ의 Shift+R 입력은 소비하지 않는다', () => {
  vi.useFakeTimers()
  const { shortcut, listener, key } = setup()
  expect(key(KEY_DOWN, VK_R, SHIFT)).toBe(77n)
  expect(key(KEY_DOWN, VK_R, SHIFT)).toBe(77n)
  expect(key(KEY_UP, VK_R, SHIFT)).toBe(77n)
  vi.runAllTimers()
  expect(listener).not.toHaveBeenCalled()
  shortcut.unregister()
})

it('다른 앱에서 시작한 키나 다른 앱으로 전환한 후 대기 중인 작업은 실행하지 않는다', () => {
  vi.useFakeTimers()
  const { shortcut, listener, key, isForeground } = setup()
  isForeground.mockReturnValue(false)
  expect(key(KEY_DOWN)).toBe(77n)
  isForeground.mockReturnValue(true)
  expect(key(KEY_DOWN)).toBe(77n)
  expect(key(KEY_UP)).toBe(77n)
  expect(key(KEY_DOWN)).toBe(1)
  isForeground.mockReturnValue(false)
  expect(key(KEY_UP)).toBe(77n)
  vi.runAllTimers()
  expect(listener).not.toHaveBeenCalled()
  shortcut.unregister()
})

it('등록을 해제하면 네이티브 hook을 내리고 대기 중인 작업과 이후 키를 처리하지 않는다', () => {
  vi.useFakeTimers()
  const { api, shortcut, listener, key } = setup()
  expect(key(KEY_DOWN)).toBe(1)
  shortcut.unregister()
  expect(api.removeHook).toHaveBeenCalledExactlyOnceWith(2n)
  expect(api.releaseCallback).toHaveBeenCalledExactlyOnceWith(1n)
  expect(key(KEY_UP)).toBe(77n)
  expect(key(KEY_DOWN)).toBe(77n)
  expect(key(KEY_UP)).toBe(77n)
  vi.runAllTimers()
  expect(listener).not.toHaveBeenCalled()
})

it('hook을 이미 쓰는 단축키가 있으면 다른 등록은 실패하고 기존 단축키는 그대로 동작한다', () => {
  vi.useFakeTimers()
  const { api, hook, shortcut, listener, key } = setup()
  const otherListener = vi.fn()
  const other = createAltKeyShortcut({ key: VK_SNAPSHOT, isForeground: () => true, hook })

  expect(other.register(otherListener)).toBe(false)
  expect(api.installHook).toHaveBeenCalledOnce()
  expect(api.removeHook).not.toHaveBeenCalled()
  expect(key(KEY_DOWN, VK_SNAPSHOT)).toBe(77n)
  expect(key(KEY_UP, VK_SNAPSHOT)).toBe(77n)
  expect(key(KEY_DOWN)).toBe(1)
  expect(key(KEY_UP)).toBe(1)
  vi.runAllTimers()
  expect(listener).toHaveBeenCalledOnce()
  expect(otherListener).not.toHaveBeenCalled()
  shortcut.unregister()
})
