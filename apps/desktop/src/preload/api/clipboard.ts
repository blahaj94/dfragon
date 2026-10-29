import { ipcRenderer } from 'electron'
import { CLIPBOARD_CHANNELS, type ClipboardApi } from '../common/types/clipboard'

export const writeText: ClipboardApi['writeText'] = async (text) => {
  await ipcRenderer.invoke(CLIPBOARD_CHANNELS.writeText, text)
}
