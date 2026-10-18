import { ipcRenderer } from 'electron'
import { SEARCH_SLOT_COUNTS, type SearchApi } from '../common/types/search'
import { parseSearchSnapshot } from '../common/search/snapshot'
import { invokeSearchCommand } from './search-command'

export const controlCharacterSearch: SearchApi['controlCharacterSearch'] = (control) =>
  invokeSearchCommand('controlRaidSearch', control)

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
