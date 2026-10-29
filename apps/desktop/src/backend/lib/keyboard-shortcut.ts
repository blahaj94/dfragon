import { win32KeyboardHook, type KeyboardEvent } from './win32-keyboard-hook'

export function createAltKeyShortcut<Key extends number>({
  keys,
  isForeground,
  hook = win32KeyboardHook
}: {
  keys: readonly Key[]
  isForeground: () => boolean
  hook?: typeof win32KeyboardHook
}): { register: (listener: (key: Key) => void) => boolean; unregister: () => void } {
  let listener: ((key: Key) => void) | null = null
  let generation = 0
  const presses = new Map<Key, boolean>()

  function isShortcutKey(key: number): key is Key {
    return (keys as readonly number[]).includes(key)
  }

  function foreground(): boolean {
    try {
      return isForeground()
    } catch {
      return false
    }
  }

  function notifyLater(key: Key): void {
    const queuedListener = listener
    const queuedGeneration = generation
    setImmediate(() => {
      if (
        queuedListener &&
        listener === queuedListener &&
        generation === queuedGeneration &&
        foreground()
      ) {
        queuedListener(key)
      }
    })
  }

  function handleKey(event: KeyboardEvent): boolean {
    const { key } = event
    if (!listener || !isShortcutKey(key)) {
      return false
    }
    const allowed = foreground()
    const { alt, control, shift, windows } = event.modifiers
    const matches = alt && !control && !shift && !windows
    const pressed = presses.get(key)
    if (event.down) {
      if (pressed === undefined) {
        const handled = allowed && matches
        presses.set(key, handled)
        if (handled) {
          notifyLater(key)
        }

        return handled
      }

      return pressed && allowed
    }
    presses.delete(key)

    return pressed === true && allowed
  }

  function unregister(): void {
    listener = null
    generation += 1
    presses.clear()
    hook.unregister(handleKey)
  }

  function register(nextListener: (key: Key) => void): boolean {
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
