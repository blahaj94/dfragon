import { win32KeyboardHook, type KeyboardEvent } from './win32-keyboard-hook'

export type ShortcutBinding<T extends string> = {
  key: number
  alt: boolean
  action: T
  releaseOnly?: boolean
}

/** Captures one matching press in an allowed foreground app and defers work outside the hook. */
export function createKeyboardShortcut<T extends string>({
  bindings,
  isForeground,
  hook = win32KeyboardHook
}: {
  bindings: readonly ShortcutBinding<T>[]
  isForeground: () => boolean
  hook?: typeof win32KeyboardHook
}): { register: (listener: (action: T) => void) => boolean; unregister: () => void } {
  let listener: ((action: T) => void) | null = null
  let generation = 0
  const presses = new Map<number, ShortcutBinding<T> | null>()

  function foreground(): boolean {
    try {
      return isForeground()
    } catch {
      return false
    }
  }

  function notifyLater(action: T): void {
    const queuedListener = listener
    const queuedGeneration = generation
    setImmediate(() => {
      if (
        queuedListener &&
        listener === queuedListener &&
        generation === queuedGeneration &&
        foreground()
      ) {
        queuedListener(action)
      }
    })
  }

  function handleKey({ key, down, modifiers }: KeyboardEvent): boolean {
    if (!listener || !bindings.some((binding) => binding.key === key)) {
      return false
    }
    const allowed = foreground()
    const noOtherModifier = !modifiers.control && !modifiers.shift && !modifiers.windows
    const binding = bindings.find(
      (candidate) => candidate.key === key && candidate.alt === modifiers.alt && noOtherModifier
    )
    const knownPress = presses.has(key)
    const handledPress = presses.get(key)
    if (down) {
      if (!knownPress) {
        const accepted = allowed && binding ? binding : null
        presses.set(key, accepted)
        if (accepted) {
          notifyLater(accepted.action)
        }

        return accepted != null
      }

      return handledPress != null && allowed
    }
    presses.delete(key)
    if (knownPress) {
      return handledPress != null && allowed
    }

    if (allowed && binding?.releaseOnly) {
      notifyLater(binding.action)

      return true
    }

    return false
  }

  function unregister(): void {
    listener = null
    generation += 1
    presses.clear()
    hook.unregister(handleKey)
  }

  function register(nextListener: (action: T) => void): boolean {
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
