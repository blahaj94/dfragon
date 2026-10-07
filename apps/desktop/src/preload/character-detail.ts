import { contextBridge, ipcRenderer } from 'electron'
import { parseCharacterDetailSnapshot } from './common/character-detail'
import type { CharacterDetailApi } from './common/types/character-detail'

const api: CharacterDetailApi = {
  async read() {
    try {
      const value: unknown = await ipcRenderer.invoke('readCharacterDetail')

      return parseCharacterDetailSnapshot(value)
    } catch {
      throw new Error('CHARACTER_DETAIL_UNAVAILABLE')
    }
  }
}

contextBridge.exposeInMainWorld('characterDetail', api)
