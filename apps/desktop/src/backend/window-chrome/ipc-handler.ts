import { ipcMain, screen, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { isMainWindowContentHeight } from '../../preload/common/window-chrome'
import {
  WINDOW_CHROME_CHANNELS,
  type WindowChromeIPCFunctions
} from '../../preload/common/types/window-chrome'

export function registerWindowChromeWindow({
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
      throw new Error('WINDOW_CHROME_NOT_ALLOWED')
    }
  }

  const setContentHeight = async (
    event: IpcMainInvokeEvent,
    ...args: Parameters<WindowChromeIPCFunctions['setWindowContentHeight']>
  ): ReturnType<WindowChromeIPCFunctions['setWindowContentHeight']> => {
    requireSender(event)
    if (args.length !== 1 || !isMainWindowContentHeight(args[0])) {
      throw new Error('INVALID_WINDOW_CHROME_COMMAND')
    }

    // 최대화, 전체 화면은 OS가 정한 크기를 유지한다. 복원하면 사용자가 둔 창 크기로 돌아간다.
    if (window.isMaximized() || window.isFullScreen()) {
      return
    }
    const workArea = screen.getDisplayMatching(window.getBounds()).workArea
    const height = Math.min(args[0], workArea.height)
    const [width] = window.getContentSize()
    window.setContentSize(width, height)
  }

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    ipcMain.removeHandler(WINDOW_CHROME_CHANNELS.setContentHeight)
    contents.removeListener('destroyed', dispose)
    window.removeListener('closed', dispose)
  }

  ipcMain.handle(WINDOW_CHROME_CHANNELS.setContentHeight, setContentHeight)
  contents.on('destroyed', dispose)
  window.on('closed', dispose)

  return dispose
}
