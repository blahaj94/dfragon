import { win32KeyboardHook, type KeyboardEvent } from './win32-keyboard-hook'

export function createAltKeyShortcut({
  key,
  isForeground,
  hook = win32KeyboardHook
}: {
  key: number
  isForeground: () => boolean
  hook?: typeof win32KeyboardHook
}): { register: (listener: () => void) => boolean; unregister: () => void } {
  let listener: (() => void) | null = null
  let generation = 0
  let press: { handled: boolean } | null = null

  function foreground(): boolean {
    try {
      return isForeground()
    } catch {
      return false
    }
  }

  function notifyLater(): void {
    const queuedListener = listener
    const queuedGeneration = generation
    setImmediate(() => {
      if (
        queuedListener &&
        listener === queuedListener &&
        generation === queuedGeneration &&
        foreground()
      ) {
        queuedListener()
      }
    })
  }

  function handleKey(event: KeyboardEvent): boolean {
    if (!listener || event.key !== key) {
      return false
    }
    const allowed = foreground()
    const { alt, control, shift, windows } = event.modifiers
    const matches = alt && !control && !shift && !windows
    if (event.down) {
      if (press == null) {
        const handled = allowed && matches
        press = { handled }
        if (handled) {
          notifyLater()
        }

        return handled
      }

      return press.handled && allowed
    }
    const released = press
    press = null

    return released != null && released.handled && allowed
  }

  function unregister(): void {
    listener = null
    generation += 1
    press = null
    hook.unregister(handleKey)
  }

  function register(nextListener: () => void): boolean {
    try {
      unregister()
    } catch {
      return false
    }
    listener = nextListener
    if (hook.register(handleKey)) {
      return true
    }
    listener = null

    return false
  }

  return { register, unregister }
}
