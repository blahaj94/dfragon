import { createRequire } from 'node:module'

type HookResult = number | bigint
type HookCallback = (code: number, message: number | bigint, data: bigint | null) => HookResult

export type KeyboardModifiers = { shift: boolean; control: boolean; alt: boolean; windows: boolean }
export type KeyboardEvent = {
  key: number
  down: boolean
  modifiers: KeyboardModifiers
}
export type KeyboardHandler = (event: KeyboardEvent) => boolean
export type Win32KeyboardApi = {
  registerCallback: (callback: HookCallback) => bigint
  releaseCallback: (callback: bigint) => void
  installHook: (callback: bigint) => bigint | null
  removeHook: (hook: bigint) => boolean
  callNext: HookCallback
  readVirtualKey: (data: bigint) => number
  readModifiers: () => KeyboardModifiers
}

export const WIN32_HOTKEY_UNAVAILABLE = 'WIN32_HOTKEY_UNAVAILABLE'
const WH_KEYBOARD_LL = 13
const VK_SHIFT = 0x10
const VK_CONTROL = 0x11
const VK_MENU = 0x12
const VK_LWIN = 0x5b
const VK_RWIN = 0x5c
const KEY_PRESSED = 0x8000
const WM_KEYDOWN = 0x100
const WM_KEYUP = 0x101
const WM_SYSKEYDOWN = 0x104
const WM_SYSKEYUP = 0x105
let nativeApi: Win32KeyboardApi | undefined

function loadWin32Api(): Win32KeyboardApi {
  if (nativeApi) {
    return nativeApi
  }
  const koffi = createRequire(__filename)('koffi') as typeof import('koffi')
  const user32 = koffi.load('user32.dll')
  const kernel32 = koffi.load('kernel32.dll')
  const hookProc = koffi.proto('__stdcall', 'DFRAGON_KEYBOARD_HOOKPROC', 'intptr_t', [
    'int',
    'uintptr_t',
    'void *'
  ])
  const setHook = user32.func('__stdcall', 'SetWindowsHookExW', 'void *', [
    'int',
    koffi.pointer(hookProc),
    'void *',
    'uint32_t'
  ])
  const unhook = user32.func('int __stdcall UnhookWindowsHookEx(void *hook)')
  const callNext = user32.func(
    'intptr_t __stdcall CallNextHookEx(void *hook, int code, uintptr_t message, void *data)'
  )
  const getModule = kernel32.func('void * __stdcall GetModuleHandleW(const uint16_t *name)')
  const getKeyState = user32.func('short __stdcall GetAsyncKeyState(int key)')
  const pressed = (key: number): boolean => (getKeyState(key) & KEY_PRESSED) !== 0
  nativeApi = {
    registerCallback: (callback) => koffi.register(callback, koffi.pointer(hookProc)),
    releaseCallback: (callback) => koffi.unregister(callback),
    installHook: (callback) => setHook(WH_KEYBOARD_LL, callback, getModule(null), 0),
    removeHook: (hook) => unhook(hook) !== 0,
    callNext: (code, message, data) => callNext(null, code, message, data),
    // Do not retain or decode typed text; consumers only inspect their shortcut keys.
    readVirtualKey: (data) => koffi.decode(data, 'uint32_t') as number,
    readModifiers: () => {
      const shift = pressed(VK_SHIFT)
      const control = pressed(VK_CONTROL)
      const alt = pressed(VK_MENU)
      const windows = pressed(VK_LWIN) || pressed(VK_RWIN)

      return { shift, control, alt, windows }
    }
  }

  return nativeApi
}

/** Shares one native hook so each subscriber observes key releases even when another handles them. */
export function createWin32KeyboardHook({
  platform = process.platform,
  loadNativeApi = loadWin32Api
}: { platform?: NodeJS.Platform; loadNativeApi?: () => Win32KeyboardApi } = {}): {
  register: (handler: KeyboardHandler) => boolean
  unregister: (handler: KeyboardHandler) => void
} {
  const handlers = new Set<KeyboardHandler>()
  let registration:
    { api: Win32KeyboardApi; callback: bigint; hook: bigint | null | undefined } | undefined

  function release(): void {
    if (!registration) {
      return
    }

    if (registration.hook === undefined) {
      // A throwing FFI installation leaves callback ownership uncertain.
      throw new Error(WIN32_HOTKEY_UNAVAILABLE)
    }

    if (registration.hook != null) {
      if (!registration.api.removeHook(registration.hook)) {
        throw new Error(WIN32_HOTKEY_UNAVAILABLE)
      }
      registration.hook = null
    }
    registration.api.releaseCallback(registration.callback)
    registration = undefined
  }

  function dispatch(
    api: Win32KeyboardApi,
    code: number,
    message: number | bigint,
    data: bigint | null
  ): HookResult {
    const event = Number(message)
    const down = event === WM_KEYDOWN || event === WM_SYSKEYDOWN
    const up = event === WM_KEYUP || event === WM_SYSKEYUP
    if (code !== 0 || data == null || handlers.size === 0 || (!down && !up)) {
      return api.callNext(code, message, data)
    }
    let handled = false
    try {
      const key = api.readVirtualKey(data)
      const modifiers = api.readModifiers()
      for (const handler of handlers) {
        try {
          handled = handler({ key, down, modifiers }) || handled
        } catch {
          // One consumer must not disrupt normal key delivery or the other subscriptions.
        }
      }
    } catch {
      // Failed native reads leave normal keyboard delivery intact.
    }

    if (handled) {
      return 1
    }

    return api.callNext(code, message, data)
  }

  function register(handler: KeyboardHandler): boolean {
    if (platform !== 'win32') {
      return false
    }
    try {
      if (handlers.size === 0) {
        release()
        const api = loadNativeApi()
        const callback = api.registerCallback((code, message, data) =>
          dispatch(api, code, message, data)
        )
        registration = { api, callback, hook: undefined }
        registration.hook = api.installHook(callback)
        if (registration.hook == null) {
          release()

          return false
        }
      }
      handlers.add(handler)

      return true
    } catch {
      return false
    }
  }

  function unregister(handler: KeyboardHandler): void {
    handlers.delete(handler)
    if (handlers.size === 0) {
      release()
    }
  }

  return { register, unregister }
}

export const win32KeyboardHook = createWin32KeyboardHook()
