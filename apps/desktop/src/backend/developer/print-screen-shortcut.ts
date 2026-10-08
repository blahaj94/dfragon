import { DEVELOPER_ERROR_CODES } from '../../preload/common/developer-errors'
import { createKeyboardShortcut } from '../lib/keyboard-shortcut'
import { createWin32KeyboardHook, type Win32KeyboardApi } from '../lib/win32-keyboard-hook'

export type PrintScreenNativeApi = Win32KeyboardApi
const VK_SNAPSHOT = 0x2c

/** 개발자 수집은 일반 Print Screen을 처리하고 Alt 조합은 파티 업로드에 맡긴다. */
export function createPrintScreenShortcut({
  isGameForeground,
  platform,
  loadNativeApi
}: {
  isGameForeground: () => boolean
  platform?: NodeJS.Platform
  loadNativeApi?: () => PrintScreenNativeApi
}): { register: (listener: () => void) => boolean; unregister: () => void } {
  const hook =
    platform != null || loadNativeApi != null
      ? createWin32KeyboardHook({ platform, loadNativeApi })
      : undefined
  const shortcut = createKeyboardShortcut({
    bindings: [{ key: VK_SNAPSHOT, alt: false, action: 'capture', releaseOnly: true }],
    isForeground: isGameForeground,
    hook
  })

  return {
    register: shortcut.register,
    unregister: () => {
      try {
        shortcut.unregister()
      } catch {
        throw new Error(DEVELOPER_ERROR_CODES.HOTKEY_UNAVAILABLE)
      }
    }
  }
}
