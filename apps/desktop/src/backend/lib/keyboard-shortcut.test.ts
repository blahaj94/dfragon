import { afterEach, expect, it, vi, type Mock } from 'vitest'
import { createKeyboardShortcut } from './keyboard-shortcut'
import {
  createWin32KeyboardHook,
  type KeyboardModifiers,
  type Win32KeyboardApi
} from './win32-keyboard-hook'

const KEY_DOWN = 0x100
const KEY_UP = 0x101
const VK_R = 0x52
const VK_SNAPSHOT = 0x2c
const NO_MODIFIERS = { shift: false, control: false, alt: false, windows: false }
const SHIFT = { ...NO_MODIFIERS, shift: true }

function setup(): {
  api: Win32KeyboardApi
  hook: ReturnType<typeof createWin32KeyboardHook>
  shortcut: ReturnType<typeof createKeyboardShortcut>
  listener: Mock
  isForeground: Mock<() => boolean>
  key: (message: number, code?: number, modifiers?: KeyboardModifiers) => number | bigint
} {
  let callback: Parameters<Win32KeyboardApi['registerCallback']>[0] | undefined
  let keyCode = VK_R
  let modifiers = SHIFT
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
  const shortcut = createKeyboardShortcut({
    bindings: [
      { key: VK_R, shift: true, action: 'restart-search' },
      { key: VK_SNAPSHOT, shift: true, action: 'upload-capture', releaseOnly: true }
    ],
    isForeground,
    hook
  })
  const listener = vi.fn()
  shortcut.register(listener)
  function key(
    message: number,
    code = VK_R,
    nextModifiers: KeyboardModifiers = SHIFT
  ): number | bigint {
    keyCode = code
    modifiers = nextModifiers

    return callback!(0, message, 3n)
  }

  return { api, hook, shortcut, listener, isForeground, key }
}

afterEach(() => vi.useRealTimers())

it('Shift+R과 Shift+PrintScreen은 한 번만 실행하고 다른 조합은 넘긴다', () => {
  vi.useFakeTimers()
  const { shortcut, listener, key } = setup()
  expect(key(KEY_DOWN)).toBe(1)
  expect(key(KEY_DOWN)).toBe(1)
  expect(key(KEY_UP)).toBe(1)
  expect(key(KEY_UP)).toBe(77n)
  vi.runAllTimers()
  expect(listener.mock.calls).toEqual([['restart-search']])
  expect(key(KEY_UP, VK_SNAPSHOT)).toBe(1)
  vi.runAllTimers()
  expect(listener.mock.calls).toEqual([['restart-search'], ['upload-capture']])
  for (const modifiers of [
    NO_MODIFIERS,
    { ...SHIFT, control: true },
    { ...SHIFT, alt: true },
    { ...SHIFT, windows: true }
  ]) {
    expect(key(KEY_DOWN, VK_R, modifiers)).toBe(77n)
    expect(key(KEY_UP, VK_R, modifiers)).toBe(77n)
  }
  vi.runAllTimers()
  expect(listener).toHaveBeenCalledTimes(2)
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

it('한 네이티브 hook을 공유하고 Shift를 먼저 떼도 개발자 캡처가 중복 실행되지 않는다', () => {
  vi.useFakeTimers()
  const { api, hook, shortcut, listener, key } = setup()
  const developerListener = vi.fn()
  const developer = createKeyboardShortcut({
    bindings: [{ key: VK_SNAPSHOT, shift: false, action: 'developer', releaseOnly: true }],
    isForeground: () => true,
    hook
  })
  developer.register(developerListener)
  expect(api.installHook).toHaveBeenCalledTimes(1)
  expect(key(KEY_DOWN, VK_SNAPSHOT)).toBe(1)
  expect(key(KEY_UP, VK_SNAPSHOT, NO_MODIFIERS)).toBe(1)
  vi.runAllTimers()
  expect(listener).toHaveBeenCalledExactlyOnceWith('upload-capture')
  expect(developerListener).not.toHaveBeenCalled()
  shortcut.unregister()
  expect(api.removeHook).not.toHaveBeenCalled()
  expect(key(KEY_UP, VK_SNAPSHOT, NO_MODIFIERS)).toBe(1)
  vi.runAllTimers()
  expect(developerListener).toHaveBeenCalledTimes(1)
  developer.unregister()
  expect(api.removeHook).toHaveBeenCalledExactlyOnceWith(2n)
  expect(api.releaseCallback).toHaveBeenCalledExactlyOnceWith(1n)
})
