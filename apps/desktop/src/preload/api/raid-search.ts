import { ipcRenderer } from 'electron'
import { SEARCH_SLOT_COUNTS, type SearchApi } from '../common/types/search'
import type { AsyncIPCFunctions } from '../common/types/ipc'
import { parseSearchSnapshot } from '../common/search/snapshot'
import { parseRaidFrame } from '../common/capture-frame'
import { makeHandlerInvoker } from '../ipc'
import { invokeSearchCommand } from './search-command'

export const controlCharacterSearch: SearchApi['controlCharacterSearch'] = (control) =>
  invokeSearchCommand('controlRaidSearch', control)

export const notifyOcrCandidatesDetected: AsyncIPCFunctions['notifyRaidOcrCandidatesDetected'] = (
  observation
) => invokeSearchCommand('notifyRaidOcrCandidatesDetected', observation)

const invokeReadCaptureFrame = makeHandlerInvoker('readRaidCaptureFrame')
export const readCaptureFrame: AsyncIPCFunctions['readRaidCaptureFrame'] = async (captureId) => {
  const value: unknown = await invokeReadCaptureFrame(captureId)

  return parseRaidFrame(value)
}

export const onCharacterSearchChanged: SearchApi['onCharacterSearchChanged'] = (listener) => {
  const wrapper = (_event: Electron.IpcRendererEvent, value: unknown): void => {
    const snapshot = parseSearchSnapshot(value, SEARCH_SLOT_COUNTS.raid)
    if (snapshot != null) {
      listener(snapshot)
    }
  }
  ipcRenderer.on('raidSearchChanged', wrapper)

  return () => {
    ipcRenderer.removeListener('raidSearchChanged', wrapper)
  }
}
