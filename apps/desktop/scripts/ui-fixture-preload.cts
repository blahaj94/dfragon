import { contextBridge, ipcRenderer } from 'electron'

// 제품 preload·IPC를 로드하지 않는다. Media API는 synthetic 거절 함수만 제공한다.
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
  notifyStableNicknameDetected: async () => {
    throw new Error('UI fixture must not run recognition')
  }
})

const developerFixture = process.argv.find((argument) =>
  argument.startsWith('--developer-fixture=')
)
if (developerFixture != null) {
  const scenario = developerFixture.slice('--developer-fixture='.length)
  const rows = [
    {
      id: 'fixture-unlabeled',
      createdAt: '2026-09-24T00:00:00.000Z',
      width: 141,
      height: 36,
      text: null,
      excluded: false,
      source: { slot: 1, frameWidth: 1920, frameHeight: 1080, scale: 1.29 }
    },
    {
      id: 'fixture-complete',
      createdAt: '2026-09-24T00:00:01.000Z',
      width: 141,
      height: 36,
      text: '바람의 검',
      excluded: false,
      source: { slot: 2, frameWidth: 1920, frameHeight: 1080, scale: 1.29 }
    },
    {
      id: 'fixture-excluded',
      createdAt: '2026-09-24T00:00:02.000Z',
      width: 141,
      height: 36,
      text: null,
      excluded: true,
      source: { slot: 3, frameWidth: 1920, frameHeight: 1080, scale: 1.29 }
    }
  ]
  const status = {
    armed: false,
    slots: [1, 2, 3, 4],
    revision: 0,
    lastSavedAt: null,
    error: scenario === 'hotkey-error' ? 'DEVELOPER_HOTKEY_UNAVAILABLE' : null
  }
  const frame = {
    width: 1920,
    height: 1080,
    scale: 1.29,
    capturedAt: '2026-09-24T00:00:03.000Z',
    slots: [1, 2, 3, 4].map((slot) => {
      const rgba = new Uint8Array(24 * 8 * 4)
      for (let pixel = 0; pixel < rgba.length; pixel += 4) {
        rgba[pixel] = 44 + slot * 33
        rgba[pixel + 1] = 82 + slot * 19
        rgba[pixel + 2] = 132 + slot * 15
        rgba[pixel + 3] = 255
      }
      return { slot, width: 24, height: 8, rgba }
    })
  }
  const developer = {
    getSettings: async () => ({ enabled: true }),
    setEnabled: async (enabled: boolean) => ({ enabled }),
    listSamples: async () => rows.map((row) => ({ ...row })),
    readImage: async (id: string) => {
      const row = rows.find((candidate) => candidate.id === id)
      const color = row?.excluded ? '#7e667f' : row?.text ? '#44785f' : '#4569a0'
      const text = row?.text ?? '미입력 크롭'
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="564" height="144" viewBox="0 0 564 144"><rect width="564" height="144" rx="12" fill="#202936"/><rect x="12" y="12" width="540" height="120" rx="8" fill="${color}"/><text x="36" y="88" fill="white" font-size="32" font-family="sans-serif">${text}</text></svg>`
      return `data:image/svg+xml,${encodeURIComponent(svg)}`
    },
    addSample: async () => {
      throw new Error('Developer fixture does not persist crops')
    },
    saveLabel: async (id: string, text: string | null) => {
      const row = rows.find((candidate) => candidate.id === id)
      if (!row) throw new Error('DEVELOPER_SAMPLE_NOT_FOUND')
      row.text = text
      return { ...row }
    },
    setSampleExcluded: async (id: string, excluded: boolean) => {
      const row = rows.find((candidate) => candidate.id === id)
      if (!row) throw new Error('DEVELOPER_SAMPLE_NOT_FOUND')
      row.excluded = excluded
      return { ...row }
    },
    captureFrame: async () => ({ pngDataUrl: '', width: 1920, height: 1080 }),
    previewParty: async () => ({
      frame: scenario === 'capture-error' ? null : frame,
      previewError: scenario === 'capture-error' ? 'DEVELOPER_GAME_NOT_FOREGROUND' : null,
      collection: { ...status }
    }),
    setPartyCollectionSlots: async (slots: Array<1 | 2 | 3 | 4> | null) => {
      status.armed = slots != null
      status.slots = slots ?? []
      return { ...status, slots: [...status.slots] }
    }
  }
  contextBridge.exposeInMainWorld('developer', developer)
}
ipcRenderer.send('ui-fixture-ready')
