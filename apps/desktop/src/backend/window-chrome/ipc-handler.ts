import { ipcMain, screen, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { isMainWindowContentHeight, MAIN_WINDOW_SIZE } from '../../preload/common/window-chrome'
import {
  WINDOW_CHROME_CHANNELS,
  type WindowChromeIPCFunctions
} from '../../preload/common/types/window-chrome'

/** 신뢰한 메인 화면의 파티 카드 접기를 창 높이에 적용한다. */
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
    // 접은 높이는 최소 높이 640의 예외다. 줄일 때는 최소 높이를 먼저 낮추고, 늘릴 때는 높이를 바꾼 뒤
    // 최소 높이를 되돌려 OS가 중간 크기로 창을 맞추지 않게 한다.
    const minimumHeight = Math.min(height, MAIN_WINDOW_SIZE.minHeight)
    const [width, currentHeight] = window.getContentSize()
    if (height < currentHeight) {
      window.setMinimumSize(MAIN_WINDOW_SIZE.minWidth, minimumHeight)
      window.setContentSize(width, height)

      return
    }
    window.setContentSize(width, height)
    window.setMinimumSize(MAIN_WINDOW_SIZE.minWidth, minimumHeight)
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
