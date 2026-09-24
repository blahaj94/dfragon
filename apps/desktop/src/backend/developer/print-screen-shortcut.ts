import { createRequire } from 'node:module'

type HookResult = number | bigint
type HookCallback = (code: number, message: number | bigint, data: bigint | null) => HookResult

export type PrintScreenNativeApi = {
  registerCallback: (callback: HookCallback) => bigint
  releaseCallback: (callback: bigint) => void
  installHook: (callback: bigint) => bigint | null
  removeHook: (hook: bigint) => boolean
  callNext: HookCallback
  readVirtualKey: (data: bigint) => number
}

type PrintScreenShortcutOptions = {
  globalShortcut: {
    register: (accelerator: string, listener: () => void) => boolean
    unregister: (accelerator: string) => void
  }
  isGameForeground: () => boolean
  platform?: NodeJS.Platform
  loadNativeApi?: () => PrintScreenNativeApi
}

const PRINT_SCREEN = 'PrintScreen'
const VK_SNAPSHOT = 0x2c
const WM_KEYDOWN = 0x100
const WM_KEYUP = 0x101
const WM_SYSKEYDOWN = 0x104
const WM_SYSKEYUP = 0x105

let nativeApi: PrintScreenNativeApi | undefined

function loadWin32Api(): PrintScreenNativeApi {
  if (nativeApi) {
    return nativeApi
  }
  const koffi = createRequire(__filename)('koffi') as typeof import('koffi')
  const user32 = koffi.load('user32.dll')
  const kernel32 = koffi.load('kernel32.dll')
  const hookProc = koffi.proto('__stdcall', 'DFC_PRINTSCREEN_HOOKPROC', 'intptr_t', [
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
  nativeApi = {
    registerCallback: (callback) => koffi.register(callback, koffi.pointer(hookProc)),
    releaseCallback: (callback) => koffi.unregister(callback),
    installHook: (callback) => setHook(13, callback, getModule(null), 0),
    removeHook: (hook) => unhook(hook) !== 0,
    callNext: (code, message, data) => callNext(null, code, message, data),
    // Only vkCode is needed; no other keyboard data is retained or decoded.
    readVirtualKey: (data) => koffi.decode(data, 'uint32_t') as number
  }
  return nativeApi
}

/** Registers the collection shortcut; the Windows fallback runs on Electron's main message loop. */
export function createPrintScreenShortcut({
  globalShortcut,
  isGameForeground,
  platform = process.platform,
  loadNativeApi = loadWin32Api
}: PrintScreenShortcutOptions): {
  register: (listener: () => void) => boolean
  unregister: () => void
} {
  let listener: (() => void) | null = null
  let generation = 0
  let electronRegistered = false
  let nativeRegistration:
    { api: PrintScreenNativeApi; callback: bigint; hook: bigint | null | undefined } | undefined
  let keyDown = false
  let handledPress = false

  function isForeground(): boolean {
    try {
      return isGameForeground()
    } catch {
      return false
    }
  }

  function notifyLater(): void {
    const queuedListener = listener
    const queuedGeneration = generation
    // Capture, storage and unregistration must not run inside the native hook callback.
    setImmediate(() => {
      if (queuedListener && listener === queuedListener && generation === queuedGeneration) {
        queuedListener()
      }
    })
  }

  function handleKey(
    api: PrintScreenNativeApi,
    code: number,
    message: number | bigint,
    data: bigint | null
  ): HookResult {
    if (code !== 0 || !listener || data == null) {
      return api.callNext(code, message, data)
    }
    let handled = false
    try {
      if (api.readVirtualKey(data) === VK_SNAPSHOT) {
        const event = Number(message)
        const foreground = isForeground()
        if (event === WM_KEYDOWN || event === WM_SYSKEYDOWN) {
          if (!keyDown) {
            keyDown = true
            handledPress = foreground
            if (handledPress) {
              notifyLater()
            }
          }
          handled = handledPress && foreground
        } else if (event === WM_KEYUP || event === WM_SYSKEYUP) {
          handled = handledPress && foreground
          keyDown = false
          handledPress = false
        }
      }
    } catch {
      // A failed decode or foreground check must leave normal keyboard delivery intact.
    }
    return handled ? 1 : api.callNext(code, message, data)
  }

  function unregister(): void {
    listener = null
    generation += 1
    keyDown = false
    handledPress = false
    if (electronRegistered) {
      globalShortcut.unregister(PRINT_SCREEN)
      electronRegistered = false
    }
    if (nativeRegistration) {
      const registration = nativeRegistration
      if (registration.hook === undefined) {
        // A throwing FFI installation has no confirmed handle; never free a possibly live callback.
        throw new Error('DEVELOPER_HOTKEY_UNAVAILABLE')
      }
      if (registration.hook != null) {
        if (!registration.api.removeHook(registration.hook)) {
          throw new Error('DEVELOPER_HOTKEY_UNAVAILABLE')
        }
        registration.hook = null
      }
      registration.api.releaseCallback(registration.callback)
      nativeRegistration = undefined
    }
  }

  function register(nextListener: () => void): boolean {
    try {
      unregister()
    } catch {
      return false
    }
    listener = nextListener
    try {
      electronRegistered = globalShortcut.register(PRINT_SCREEN, () => {
        if (listener && isForeground()) {
          notifyLater()
        }
      })
    } catch {
      electronRegistered = false
    }
    if (electronRegistered) {
      return true
    }
    if (platform !== 'win32') {
      listener = null
      return false
    }

    try {
      const api = loadNativeApi()
      const callback = api.registerCallback((code, message, data) =>
        handleKey(api, code, message, data)
      )
      nativeRegistration = { api, callback, hook: undefined }
      nativeRegistration.hook = api.installHook(callback)
      if (nativeRegistration.hook != null) {
        return true
      }
      unregister()
    } catch {
      listener = null
    }
    return false
  }

  return { register, unregister }
}
