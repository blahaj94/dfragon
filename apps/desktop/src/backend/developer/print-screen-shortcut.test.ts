import { afterEach, expect, it, vi, type Mock } from 'vitest'
import { createPrintScreenShortcut, type PrintScreenNativeApi } from './print-screen-shortcut'

const KEY_DOWN = 0x100
const KEY_UP = 0x101
const SNAPSHOT = 0x2c

type ShortcutTestContext = {
  api: PrintScreenNativeApi
  isGameForeground: Mock<() => boolean>
  loadNativeApi: Mock<() => PrintScreenNativeApi>
  shortcut: ReturnType<typeof createPrintScreenShortcut>
  listener: Mock<() => void>
  key: (message: number, code?: number, keyCode?: number) => number | bigint
}

function setup(platform: NodeJS.Platform = 'win32'): ShortcutTestContext {
  let hookCallback: Parameters<PrintScreenNativeApi['registerCallback']>[0] | undefined
  let virtualKey = SNAPSHOT
  const api: PrintScreenNativeApi = {
    registerCallback: vi.fn((callback) => {
      hookCallback = callback
      return 10n
    }),
    releaseCallback: vi.fn(),
    installHook: vi.fn(() => 20n),
    removeHook: vi.fn(() => true),
    callNext: vi.fn(() => 77n),
    readVirtualKey: vi.fn(() => virtualKey)
  }
  const isGameForeground = vi.fn(() => true)
  const loadNativeApi = vi.fn(() => api)
  const shortcut = createPrintScreenShortcut({
    isGameForeground,
    platform,
    loadNativeApi
  })
  const listener = vi.fn()
  function key(message: number, code = 0, keyCode = SNAPSHOT): number | bigint {
    virtualKey = keyCode
    return hookCallback!(code, message, 30n)
  }
  return { api, isGameForeground, loadNativeApi, shortcut, listener, key }
}

afterEach(() => {
  vi.useRealTimers()
})

it('uses the native hook on Windows and does not load Windows libraries on another OS', () => {
  const supported = setup()
  expect(supported.shortcut.register(supported.listener)).toBe(true)
  expect(supported.api.installHook).toHaveBeenCalledTimes(1)
  supported.shortcut.unregister()
  expect(supported.api.removeHook).toHaveBeenCalledWith(20n)

  const unsupported = setup('darwin')
  expect(unsupported.shortcut.register(unsupported.listener)).toBe(false)
  expect(unsupported.loadNativeApi).not.toHaveBeenCalled()
})

it('passes an entire Print Screen press to the foreground app outside DNF', () => {
  vi.useFakeTimers()
  const { shortcut, listener, key, api, isGameForeground } = setup()
  isGameForeground.mockReturnValue(false)
  shortcut.register(listener)
  expect(key(KEY_DOWN)).toBe(77n)
  expect(key(KEY_UP)).toBe(77n)
  vi.runAllTimers()
  expect(api.callNext).toHaveBeenNthCalledWith(1, 0, KEY_DOWN, 30n)
  expect(api.callNext).toHaveBeenNthCalledWith(2, 0, KEY_UP, 30n)
  expect(listener).not.toHaveBeenCalled()
  shortcut.unregister()
})

it('swallows one foreground Print Screen sequence, defers capture, and ignores repeats', () => {
  vi.useFakeTimers()
  const { shortcut, listener, key, api } = setup()
  expect(shortcut.register(listener)).toBe(true)
  expect(key(KEY_DOWN)).toBe(1)
  expect(key(KEY_DOWN)).toBe(1)
  expect(key(KEY_UP)).toBe(1)
  expect(listener).not.toHaveBeenCalled()
  vi.runAllTimers()
  expect(listener).toHaveBeenCalledTimes(1)
  expect(api.callNext).not.toHaveBeenCalled()

  expect(key(0x104)).toBe(1)
  expect(key(0x105)).toBe(1)
  vi.runAllTimers()
  expect(listener).toHaveBeenCalledTimes(2)
  shortcut.unregister()
})

it('chains other keys and negative hook codes without capturing', () => {
  const { shortcut, listener, key, api, isGameForeground } = setup()
  shortcut.register(listener)
  expect(key(KEY_DOWN, -1)).toBe(77n)
  expect(api.readVirtualKey).not.toHaveBeenCalled()
  expect(key(KEY_DOWN, 0, 0x41)).toBe(77n)
  expect(isGameForeground).not.toHaveBeenCalled()
  expect(listener).not.toHaveBeenCalled()
  expect(api.callNext).toHaveBeenNthCalledWith(1, -1, KEY_DOWN, 30n)
  shortcut.unregister()
})

it('captures release-only Print Screen in the game without requiring a preceding keydown', () => {
  vi.useFakeTimers()
  const { shortcut, listener, key, api } = setup()
  shortcut.register(listener)
  expect(key(KEY_UP)).toBe(1)
  expect(listener).not.toHaveBeenCalled()
  vi.runAllTimers()
  expect(listener).toHaveBeenCalledTimes(1)
  expect(key(0x105)).toBe(1)
  vi.runAllTimers()
  expect(listener).toHaveBeenCalledTimes(2)
  expect(api.callNext).not.toHaveBeenCalled()
  shortcut.unregister()
})

it('passes release-only Print Screen outside the game and cancels it when unregistered', () => {
  vi.useFakeTimers()
  const { shortcut, listener, key, isGameForeground } = setup()
  shortcut.register(listener)
  isGameForeground.mockReturnValue(false)
  expect(key(KEY_UP)).toBe(77n)
  vi.runAllTimers()
  expect(listener).not.toHaveBeenCalled()
  isGameForeground.mockReturnValue(true)
  expect(key(KEY_UP)).toBe(1)
  shortcut.unregister()
  vi.runAllTimers()
  expect(listener).not.toHaveBeenCalled()
})

it('does not capture a press started outside the game when focus changes during repeats', () => {
  vi.useFakeTimers()
  const { shortcut, listener, key, isGameForeground } = setup()
  shortcut.register(listener)
  isGameForeground.mockReturnValue(false)
  expect(key(KEY_DOWN)).toBe(77n)
  isGameForeground.mockReturnValue(true)
  expect(key(KEY_DOWN)).toBe(77n)
  expect(key(KEY_UP)).toBe(77n)
  vi.runAllTimers()
  expect(listener).not.toHaveBeenCalled()

  expect(key(KEY_DOWN)).toBe(1)
  isGameForeground.mockReturnValue(false)
  expect(key(KEY_DOWN)).toBe(77n)
  expect(key(KEY_UP)).toBe(77n)
  shortcut.unregister()
})

it('passes the key through when reading native data or checking the game fails', () => {
  const { shortcut, listener, key, api, isGameForeground } = setup()
  shortcut.register(listener)
  vi.mocked(api.readVirtualKey).mockImplementationOnce(() => {
    throw new Error('read failed')
  })
  expect(key(KEY_DOWN)).toBe(77n)
  isGameForeground.mockImplementation(() => {
    throw new Error('foreground failed')
  })
  expect(key(KEY_DOWN)).toBe(77n)
  expect(listener).not.toHaveBeenCalled()
  shortcut.unregister()
})

it('cancels queued capture across unregister and re-register, including the same listener', () => {
  vi.useFakeTimers()
  const { shortcut, listener, key } = setup()
  shortcut.register(listener)
  key(KEY_DOWN)
  shortcut.unregister()
  shortcut.register(listener)
  vi.runAllTimers()
  expect(listener).not.toHaveBeenCalled()
  key(KEY_DOWN)
  vi.runAllTimers()
  expect(listener).toHaveBeenCalledTimes(1)
  shortcut.unregister()
})

it('unhooks before releasing its registered callback and does not release twice', () => {
  const { shortcut, listener, api } = setup()
  shortcut.register(listener)
  shortcut.unregister()
  expect(api.removeHook).toHaveBeenCalledWith(20n)
  expect(api.releaseCallback).toHaveBeenCalledWith(10n)
  expect(vi.mocked(api.removeHook).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(api.releaseCallback).mock.invocationCallOrder[0]
  )
  shortcut.unregister()
  expect(api.releaseCallback).toHaveBeenCalledTimes(1)
})

it('retains a live callback after failed unhook, stops handling keys, and can retry cleanup', () => {
  vi.useFakeTimers()
  const { shortcut, listener, api, key } = setup()
  shortcut.register(listener)
  key(KEY_DOWN)
  vi.mocked(api.removeHook).mockReturnValue(false)
  expect(() => shortcut.unregister()).toThrow('DEVELOPER_HOTKEY_UNAVAILABLE')
  expect(api.releaseCallback).not.toHaveBeenCalled()
  expect(key(KEY_DOWN)).toBe(77n)
  vi.runAllTimers()
  expect(listener).not.toHaveBeenCalled()
  expect(shortcut.register(listener)).toBe(false)
  expect(api.registerCallback).toHaveBeenCalledTimes(1)

  vi.mocked(api.removeHook).mockReturnValue(true)
  shortcut.unregister()
  expect(api.releaseCallback).toHaveBeenCalledTimes(1)
})

it('releases a callback if installation returns no hook, but retains it if installation throws', () => {
  const failed = setup()
  vi.mocked(failed.api.installHook).mockReturnValue(null)
  expect(failed.shortcut.register(failed.listener)).toBe(false)
  expect(failed.api.removeHook).not.toHaveBeenCalled()
  expect(failed.api.releaseCallback).toHaveBeenCalledWith(10n)

  const uncertain = setup()
  vi.mocked(uncertain.api.installHook).mockImplementation(() => {
    throw new Error('FFI failed')
  })
  expect(uncertain.shortcut.register(uncertain.listener)).toBe(false)
  expect(uncertain.api.releaseCallback).not.toHaveBeenCalled()
  expect(uncertain.key(KEY_DOWN)).toBe(77n)
  expect(() => uncertain.shortcut.unregister()).toThrow('DEVELOPER_HOTKEY_UNAVAILABLE')
  expect(uncertain.api.releaseCallback).not.toHaveBeenCalled()
})
