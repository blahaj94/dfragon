import { ipcMain, screen, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { isMainWindowContentHeight } from '../../preload/common/window-chrome'
import {
  WINDOW_CHROME_CHANNELS,
  type WindowChromeIPCFunctions
} from '../../preload/common/types/window-chrome'

/** 신뢰한 메인 화면이 보이는 화면(파티, 공대)에 맞춰 요청한 내용 높이를 창에 적용한다. */
export function registerWindowChromeWindow({
  window,
  documentUrl
}: {
  window: BrowserWindow
  documentUrl: string
}): () => void {
  let disposed = false
  // 등록에 성공한 채널만 지운다. 등록에 실패한 채널의 기존 handler는 이 창의 것이 아니다.
  const registeredChannels: string[] = []
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
    // 사용자가 바꾼 폭은 유지하고 높이만 화면의 높이로 맞춘다. 사용자가 키운 높이는 화면을 바꾸면 그 화면의
    // 높이로 돌아간다.
    const [width] = window.getContentSize()
    window.setContentSize(width, height)
  }

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    for (const channel of registeredChannels) {
      ipcMain.removeHandler(channel)
    }
    contents.removeListener('destroyed', dispose)
    window.removeListener('closed', dispose)
  }

  try {
    ipcMain.handle(WINDOW_CHROME_CHANNELS.setContentHeight, setContentHeight)
    registeredChannels.push(WINDOW_CHROME_CHANNELS.setContentHeight)
    contents.on('destroyed', dispose)
    window.on('closed', dispose)
  } catch (error) {
    dispose()
    throw error
  }

  return dispose
}
