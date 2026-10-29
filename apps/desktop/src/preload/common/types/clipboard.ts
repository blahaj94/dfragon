export const CLIPBOARD_CHANNELS = {
  writeText: 'writeClipboardText'
} as const

export interface ClipboardIPCFunctions {
  writeClipboardText: (text: string) => Promise<void>
}

export interface ClipboardApi {
  writeText: (text: string) => Promise<void>
}
