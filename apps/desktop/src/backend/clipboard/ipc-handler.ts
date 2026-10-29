import { clipboard, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import {
  CLIPBOARD_CHANNELS,
  type ClipboardIPCFunctions
} from '../../preload/common/types/clipboard'

// 공대 12자리의 이름, 서버, 모험단을 모두 담아도 1,000자를 넘지 않으므로 넉넉히 둔 상한이다.
const MAX_CLIPBOARD_TEXT_LENGTH = 4096

function isClipboardText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_CLIPBOARD_TEXT_LENGTH
}

export function registerClipboardWindow({
  window,
  documentUrl
}: {
  window: BrowserWindow
  documentUrl: string
}): () => void {
  let disposed = false
  const contents = window.webContents

  function requireSender(event: IpcMainInvokeEvent): void {
    const alive = !disposed && !window.isDestroyed() && !contents.isDestroyed()
    const frame = alive ? contents.mainFrame : null
    const fromMainFrame = frame != null && event.senderFrame === frame
    const attached = fromMainFrame && !frame.isDestroyed() && !frame.detached
    if (!attached || event.sender !== contents || frame.url !== documentUrl) {
      throw new Error('CLIPBOARD_NOT_ALLOWED')
    }
  }

  const writeText = async (
    event: IpcMainInvokeEvent,
    ...args: Parameters<ClipboardIPCFunctions['writeClipboardText']>
  ): ReturnType<ClipboardIPCFunctions['writeClipboardText']> => {
    requireSender(event)
    if (args.length !== 1 || !isClipboardText(args[0])) {
      throw new Error('INVALID_CLIPBOARD_COMMAND')
    }

    clipboard.writeText(args[0])
  }

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    ipcMain.removeHandler(CLIPBOARD_CHANNELS.writeText)
    contents.removeListener('destroyed', dispose)
    window.removeListener('closed', dispose)
  }

  ipcMain.handle(CLIPBOARD_CHANNELS.writeText, writeText)
  contents.on('destroyed', dispose)
  window.on('closed', dispose)

  return dispose
}
