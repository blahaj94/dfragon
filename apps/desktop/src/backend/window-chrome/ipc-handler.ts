import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { isWindowChromeTheme, WINDOW_CHROME_COLORS } from '../../preload/common/window-chrome'
import { canColorTitleBarOverlay, getTitleBarOverlay } from './title-bar-overlay'
import {
  WINDOW_CHROME_CHANNELS,
  type WindowChromeIPCFunctions
} from '../../preload/common/types/window-chrome'

/** 신뢰한 메인 화면의 테마를 OS 창 버튼과 창 배경에 적용한다. */
export function registerWindowChromeWindow({
  window,
  documentUrl,
  platform = process.platform
}: {
  window: BrowserWindow
  documentUrl: string
  platform?: NodeJS.Platform
}): () => void {
  let disposed = false
  let registered = false
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

  const setTheme = async (
    event: IpcMainInvokeEvent,
    ...args: Parameters<WindowChromeIPCFunctions['setWindowChromeTheme']>
  ): ReturnType<WindowChromeIPCFunctions['setWindowChromeTheme']> => {
    requireSender(event)
    if (args.length !== 1 || !isWindowChromeTheme(args[0])) {
      throw new Error('INVALID_WINDOW_CHROME_COMMAND')
    }
    const theme = args[0]
    if (canColorTitleBarOverlay(platform)) {
      window.setTitleBarOverlay(getTitleBarOverlay(platform, theme))
    }
    window.setBackgroundColor(WINDOW_CHROME_COLORS[theme].color)
  }

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    if (registered) {
      ipcMain.removeHandler(WINDOW_CHROME_CHANNELS.setTheme)
    }
    contents.removeListener('destroyed', dispose)
    window.removeListener('closed', dispose)
  }

  try {
    ipcMain.handle(WINDOW_CHROME_CHANNELS.setTheme, setTheme)
    registered = true
    contents.on('destroyed', dispose)
    window.on('closed', dispose)
  } catch (error) {
    dispose()
    throw error
  }

  return dispose
}
