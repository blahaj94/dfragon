import { ipcRenderer } from 'electron'
import type { SearchApi } from '../common/types/search'
import { parseSearchSnapshot } from '../common/search/snapshot'
import { invokeSearchCommand } from './search-command'

export const controlCharacterSearch: SearchApi['controlCharacterSearch'] = (control) =>
  invokeSearchCommand('controlManualSearch', control)

export const onCharacterSearchChanged: SearchApi['onCharacterSearchChanged'] = (listener) => {
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
