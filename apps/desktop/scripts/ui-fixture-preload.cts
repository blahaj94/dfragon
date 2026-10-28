import { contextBridge, ipcRenderer } from 'electron'

// 제품 preload, IPC를 로드하지 않는다. Media API는 synthetic 거절 함수만 제공한다.
const isMediaIsolated = contextBridge.executeInMainWorld({
  func: (): boolean => {
    const rejectCapture = (): Promise<never> =>
      Promise.reject(new Error('UI fixture: media capture blocked.'))
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: false,
      value: Object.freeze({ getDisplayMedia: rejectCapture })
    })
    const isStubInstalled = navigator.mediaDevices.getDisplayMedia === rejectCapture

    return isStubInstalled
  }
})

if (!isMediaIsolated) {
  throw new Error('UI fixture media isolation failed')
}

contextBridge.exposeInMainWorld('api', {
  listCaptureSources: async () => [{ id: 'example-window', name: 'Example window' }],
  selectCaptureSource: async () => null,
  notifyOcrCandidatesDetected: async () => {
    throw new Error('UI fixture must not run recognition')
  }
})

contextBridge.exposeInMainWorld('diagnostics', {
  getDiagnosticHistory: async () => [],
  reportRendererDiagnostic: async () => {},
  onDiagnosticEntry: () => () => {}
})
contextBridge.exposeInMainWorld('desktopShortcut', { onDesktopShortcut: () => () => {} })

const blockedSearch = {
  controlCharacterSearch: async () => {
    throw new Error('UI fixture must not run character search')
  },
  onCharacterSearchChanged: () => () => {}
}
contextBridge.exposeInMainWorld('search', blockedSearch)
contextBridge.exposeInMainWorld('manualSearch', blockedSearch)
contextBridge.exposeInMainWorld('raidSearch', {
  ...blockedSearch,
  notifyOcrCandidatesDetected: async () => {
    throw new Error('UI fixture must not run recognition')
  },
  readCaptureFrame: async () => {
    throw new Error('UI fixture must not read capture frames')
  }
})
contextBridge.exposeInMainWorld('updateNotice', {
  getUpdateNotice: async () => ({ revision: 0, notice: null }),
  dismissUpdateNotice: async () => ({ revision: 0, notice: null }),
  openUpdateRelease: async () => {},
  onUpdateNoticeChanged: () => () => {}
})
contextBridge.exposeInMainWorld('windowChrome', { setContentHeight: async () => {} })

ipcRenderer.send('ui-fixture-ready')
