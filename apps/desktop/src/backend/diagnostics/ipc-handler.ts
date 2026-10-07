import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent, type Input } from 'electron'
import { isRendererDiagnosticCode } from '../../preload/common/diagnostics'
import {
  DIAGNOSTIC_CHANNELS,
  type DiagnosticIPCFunctions
} from '../../preload/common/types/diagnostics'
import { diagnosticLog, type DiagnosticLog } from './log'

/** 신뢰한 메인 화면에 진단 기록과 DevTools 단축키를 연결한다. */
export function registerDiagnosticsWindow({
  window,
  documentUrl,
  log = diagnosticLog
}: {
  window: BrowserWindow
  documentUrl: string
  log?: DiagnosticLog
}): () => void {
  let disposed = false
  let historyRegistered = false
  let reportRegistered = false
  const contents = window.webContents

  function hasTrustedDocument(): boolean {
    if (disposed || window.isDestroyed() || contents.isDestroyed()) {
      return false
    }
    const frame = contents.mainFrame

    return !frame.isDestroyed() && !frame.detached && frame.url === documentUrl
  }

  function requireSender(event: IpcMainInvokeEvent): void {
    if (
      !hasTrustedDocument() ||
      event.sender !== contents ||
      event.senderFrame !== contents.mainFrame
    ) {
      throw new Error('DIAGNOSTICS_NOT_ALLOWED')
    }
  }

  const history = async (
    event: IpcMainInvokeEvent,
    ...args: Parameters<DiagnosticIPCFunctions['getDiagnosticHistory']>
  ): ReturnType<DiagnosticIPCFunctions['getDiagnosticHistory']> => {
    requireSender(event)
    if (args.length !== 0) {
      throw new Error('INVALID_DIAGNOSTIC_COMMAND')
    }

    return log.history()
  }

  const report = async (
    event: IpcMainInvokeEvent,
    ...args: Parameters<DiagnosticIPCFunctions['reportRendererDiagnostic']>
  ): ReturnType<DiagnosticIPCFunctions['reportRendererDiagnostic']> => {
    requireSender(event)
    if (args.length !== 1 || !isRendererDiagnosticCode(args[0])) {
      throw new Error('INVALID_DIAGNOSTIC_COMMAND')
    }
    log.report(args[0])
  }

  const unsubscribe = log.subscribe((entry) => {
    if (hasTrustedDocument()) {
      contents.send(DIAGNOSTIC_CHANNELS.entry, entry)
    }
  })

  function beforeInput(event: { preventDefault: () => void }, input: Input): void {
    const isDevToolsShortcut =
      input.type === 'keyDown' &&
      input.key.toLowerCase() === 'i' &&
      input.control &&
      input.shift &&
      !input.alt &&
      !input.meta &&
      !input.isAutoRepeat
    if (!hasTrustedDocument() || !isDevToolsShortcut) {
      return
    }
    event.preventDefault()
    if (contents.isDevToolsOpened()) {
      contents.closeDevTools()

      return
    }
    contents.openDevTools({ mode: 'detach' })
  }

  function rendererGone(): void {
    log.report('RENDERER_PROCESS_GONE')
  }

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    unsubscribe()
    if (historyRegistered) {
      ipcMain.removeHandler(DIAGNOSTIC_CHANNELS.history)
    }

    if (reportRegistered) {
      ipcMain.removeHandler(DIAGNOSTIC_CHANNELS.report)
    }
    contents.removeListener('before-input-event', beforeInput)
    contents.removeListener('render-process-gone', rendererGone)
    contents.removeListener('destroyed', dispose)
    window.removeListener('closed', dispose)
  }

  try {
    ipcMain.handle(DIAGNOSTIC_CHANNELS.history, history)
    historyRegistered = true
    ipcMain.handle(DIAGNOSTIC_CHANNELS.report, report)
    reportRegistered = true
    contents.on('before-input-event', beforeInput)
    contents.on('render-process-gone', rendererGone)
    contents.on('destroyed', dispose)
    window.on('closed', dispose)
  } catch (error) {
    dispose()
    throw error
  }

  return dispose
}
