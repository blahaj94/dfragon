import { contextBridge } from 'electron'
import { searchSnapshot } from '../../src/preload/api/search-test-fixture'
import * as auth from '../../src/preload/api/auth'

contextBridge.exposeInMainWorld('auth', auth)

// Auth-only fixture: capture controls stay visible without starting media or search effects.
contextBridge.exposeInMainWorld('api', {
  listCaptureSources: async () => [],
  selectCaptureSource: async () => null,
  notifyStableNicknameDetected: async () => {
    throw new Error('Capture is disabled in this fixture')
  }
})
contextBridge.exposeInMainWorld('search', {
  controlCharacterSearch: async () => ({ ok: true, snapshot: searchSnapshot({ captureId: null }) }),
  onCharacterSearchChanged: () => () => {}
})
