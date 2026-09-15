import { ipcRenderer } from 'electron'
import type { ManualSearchApi } from '../common/types/search'
import { parseSearchSnapshot } from '../common/search/snapshot'
import { invokeSearchCommand } from './search-command'

export const controlCharacterSearch: ManualSearchApi['controlCharacterSearch'] = (control) =>
  invokeSearchCommand('controlManualSearch', control)

export const notifyManualNickname: ManualSearchApi['notifyManualNickname'] = (observation) =>
  invokeSearchCommand('notifyManualNickname', observation)

export const onCharacterSearchChanged: ManualSearchApi['onCharacterSearchChanged'] = (listener) => {
  const wrapper = (_event: Electron.IpcRendererEvent, value: unknown): void => {
    const snapshot = parseSearchSnapshot(value)
    if (snapshot != null) {
      listener(snapshot)
    }
  }
  ipcRenderer.on('manualSearchChanged', wrapper)
  return () => {
    ipcRenderer.removeListener('manualSearchChanged', wrapper)
  }
}
