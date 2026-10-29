import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import {
  TODAY_GRADE_CHANNELS,
  type TodayGrade,
  type TodayGradeIPCFunctions
} from '../../preload/common/types/today-grade'

export function registerTodayGradeWindow({
  window,
  documentUrl,
  readGrade
}: {
  window: BrowserWindow
  documentUrl: string
  readGrade: () => Promise<TodayGrade>
}): () => void {
  let disposed = false
  const contents = window.webContents

  function requireSender(event: IpcMainInvokeEvent): void {
    const alive = !disposed && !window.isDestroyed() && !contents.isDestroyed()
    const frame = alive ? contents.mainFrame : null
    const fromMainFrame = frame != null && event.senderFrame === frame
    const attached = fromMainFrame && !frame.isDestroyed() && !frame.detached
    if (!attached || event.sender !== contents || frame.url !== documentUrl) {
      throw new Error('TODAY_GRADE_NOT_ALLOWED')
    }
  }

  const read = async (
    event: IpcMainInvokeEvent,
    ...args: Parameters<TodayGradeIPCFunctions['getTodayGrade']>
  ): ReturnType<TodayGradeIPCFunctions['getTodayGrade']> => {
    requireSender(event)
    if (args.length !== 0) {
      throw new Error('INVALID_TODAY_GRADE_COMMAND')
    }
    try {
      return await readGrade()
    } catch {
      // API 응답과 transport 오류의 원문은 renderer에 넘기지 않는다.
      throw new Error('TODAY_GRADE_UNAVAILABLE')
    }
  }

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    ipcMain.removeHandler(TODAY_GRADE_CHANNELS.read)
    contents.removeListener('destroyed', dispose)
    window.removeListener('closed', dispose)
  }

  ipcMain.handle(TODAY_GRADE_CHANNELS.read, read)
  contents.on('destroyed', dispose)
  window.on('closed', dispose)

  return dispose
}
