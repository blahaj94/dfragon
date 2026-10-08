import { ipcRenderer } from 'electron'
import {
  isRendererDiagnosticCode,
  parseDiagnosticEntry,
  parseDiagnosticHistory
} from '../common/diagnostics'
import { DIAGNOSTIC_CHANNELS, type DiagnosticApi } from '../common/types/diagnostics'

export const getDiagnosticHistory: DiagnosticApi['getDiagnosticHistory'] = async () => {
  const value: unknown = await ipcRenderer.invoke(DIAGNOSTIC_CHANNELS.history)
  const history = parseDiagnosticHistory(value)
  if (history == null) {
    throw new Error('INVALID_DIAGNOSTIC_RESPONSE')
  }

  return history
}

export const reportRendererDiagnostic: DiagnosticApi['reportRendererDiagnostic'] = async (code) => {
  if (!isRendererDiagnosticCode(code)) {
    throw new Error('INVALID_DIAGNOSTIC_COMMAND')
  }
  await ipcRenderer.invoke(DIAGNOSTIC_CHANNELS.report, code)
}

export const onDiagnosticEntry: DiagnosticApi['onDiagnosticEntry'] = (listener) => {
  const handle = (_event: unknown, value: unknown): void => {
    const entry = parseDiagnosticEntry(value)
    if (entry != null) {
      listener(entry)
    }
  }
  ipcRenderer.on(DIAGNOSTIC_CHANNELS.entry, handle)

  return () => {
    ipcRenderer.removeListener(DIAGNOSTIC_CHANNELS.entry, handle)
  }
}
