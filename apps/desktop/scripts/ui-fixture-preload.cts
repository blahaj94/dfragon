import type {
  DeveloperCollectionKind,
  DeveloperParticipantWindow,
  DeveloperPartyCollectionStatus,
  DeveloperPartyPreviewFrame,
  DeveloperPartySlot,
  DeveloperSample
} from '../src/preload/common/types/developer'
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
  const raidScenario = scenario === 'raid' || scenario === 'raid-sparse'
  const rows: DeveloperSample[] = [
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
  if (raidScenario) {
    rows[0] = {
      ...rows[0],
      id: 'fixture-raid-12',
      width: 86,
      height: 17,
      source: { kind: 'raid', slot: 12, frameWidth: 1067, frameHeight: 600, scale: 1 }
    }
  }
  const status: DeveloperPartyCollectionStatus = {
    armed: false,
    slots: [1, 2, 3, 4],
    revision: 0,
    lastSavedAt: null,
    error: scenario === 'hotkey-error' ? 'DEVELOPER_HOTKEY_UNAVAILABLE' : null
  }
  const frame: DeveloperPartyPreviewFrame = {
    width: 1920,
    height: 1080,
    scale: 1.29,
    capturedAt: '2026-09-24T00:00:03.000Z',
    slots: ([1, 2, 3, 4] as const).map((slot) => {
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
  // Synthetic UI pixels only; this fixture never reads a game window or private screenshots.
  const participantWindow: DeveloperParticipantWindow = contextBridge.executeInMainWorld({
    func: (sparse: boolean) => {
      const canvas = document.createElement('canvas')
      canvas.width = 394
      canvas.height = 210
      const context = canvas.getContext('2d')!
      context.fillStyle = '#131619'
      context.fillRect(0, 0, 394, 210)
      context.fillStyle = '#363e52'
      context.fillRect(0, 0, 394, 20)
      context.fillStyle = '#eee'
      context.font = '11px sans-serif'
      context.fillText('파티참가인원 — 개발 테스트', 110, 14)
      context.fillStyle = '#d4c59a'
      context.font = 'bold 14px sans-serif'
      context.fillText('테스트 던전 · 테스트 파티', 32, 49)
      context.fillStyle = '#27251b'
      context.fillRect(14, 67, 368, 17)
      context.fillStyle = '#b5a67a'
      context.font = '10px sans-serif'
      for (const [label, x] of [
        ['레벨', 44],
        ['장비 점수', 95],
        ['캐릭터 이름', 180],
        ['직업명', 304]
      ] as const) {
        context.fillText(label, x, 79)
      }
      const names = ['테스트검신', '테스트뮤즈', '테스트레인저', '테스트아처']
      const rows = names.map((name, index) => {
        const y = 87 + index * 22
        const occupied = !sparse || index === 2
        context.strokeStyle = '#3e4140'
        context.strokeRect(14, y - 3, 368, 21)
        context.fillStyle = '#d4c59a'
        context.font = '11px sans-serif'
        if (occupied) {
          context.fillText('115', 65, y + 12)
          context.fillText('123,456', 96, y + 12)
          context.fillText(name, 180, y + 12)
          context.fillText('테스트 직업', 270, y + 12)
          context.fillStyle = '#6c718d'
          context.fillRect(47, y + 1, 14, 14)
        } else {
          context.fillText('◇', 194, y + 12)
        }
        return { slot: (index + 1) as 1 | 2 | 3 | 4, occupied, x: 168, y, width: 84, height: 15 }
      })
      return {
        width: 394,
        height: 210,
        rgba: new Uint8Array(context.getImageData(0, 0, 394, 210).data),
        rows
      }
    },
    args: [scenario === 'participants-sparse']
  })
  const raidWindow: DeveloperParticipantWindow = contextBridge.executeInMainWorld({
    func: (occupiedCount: number) => {
      const canvas = document.createElement('canvas')
      canvas.width = 465
      canvas.height = 392
      const context = canvas.getContext('2d')!
      context.fillStyle = '#14191e'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#363e52'
      context.fillRect(0, 0, canvas.width, 24)
      context.fillStyle = '#eee'
      context.font = '12px sans-serif'
      context.fillText('공대 상세 — 개발 테스트', 159, 17)
      context.fillStyle = '#d4c59a'
      context.font = 'bold 14px sans-serif'
      context.fillText('테스트 레이드 · 합성 공대', 22, 53)
      context.font = '11px sans-serif'
      context.fillText(`${occupiedCount} / 12명`, 376, 53)
      context.fillStyle = '#27251b'
      context.fillRect(14, 73, 437, 23)
      context.fillStyle = '#b5a67a'
      context.font = '10px sans-serif'
      for (const [label, x] of [
        ['파티', 23],
        ['레벨', 67],
        ['장비 점수', 108],
        ['캐릭터 이름', 209],
        ['직업명', 330]
      ] as const) {
        context.fillText(label, x, 88)
      }
      const rows = Array.from({ length: 12 }, (_, index) => {
        const y = 101 + index * 21
        const occupied = index < occupiedCount
        context.strokeStyle = '#353b3e'
        context.strokeRect(14, y - 2, 437, 21)
        if (occupied) {
          const party = index < 4 ? 'R' : index < 8 ? 'Y' : index < 11 ? 'G' : '싱글'
          context.fillStyle = index < 4 ? '#d76066' : index < 8 ? '#d4bb50' : '#79ab74'
          context.font = '11px sans-serif'
          context.fillText(party, 25, y + 13)
          context.fillStyle = '#d4c59a'
          context.fillText('115', 68, y + 13)
          context.fillText(index === 0 ? '1000.4K' : `${982000 - index * 2123}`, 111, y + 13)
          context.fillText(`테스트공대${String(index + 1).padStart(2, '0')}`, 205, y + 13)
          context.fillText('테스트 직업', 331, y + 13)
        }
        return {
          slot: (index + 1) as DeveloperPartySlot,
          occupied,
          x: 202,
          y,
          width: 86,
          height: 17
        }
      })
      context.fillStyle = '#959b9f'
      context.font = '10px sans-serif'
      context.fillText('화면 검증용 합성 이미지', 174, 375)
      return {
        width: canvas.width,
        height: canvas.height,
        rgba: new Uint8Array(context.getImageData(0, 0, canvas.width, canvas.height).data),
        rows
      }
    },
    args: [scenario === 'raid-sparse' ? 9 : 12]
  })
  // Read the displayed synthetic pixels so each preview matches its outlined nickname area.
  function popupFrame(participantWindow: DeveloperParticipantWindow): DeveloperPartyPreviewFrame {
    return {
      width: 1067,
      height: 600,
      scale: 1,
      capturedAt: frame.capturedAt,
      participantWindow,
      slots: participantWindow.rows
        .filter((row) => row.occupied)
        .map((row) => {
          const rgba = new Uint8Array(row.width * row.height * 4)
          for (let y = 0; y < row.height; y += 1) {
            const start = ((row.y + y) * participantWindow.width + row.x) * 4
            rgba.set(
              participantWindow.rgba.subarray(start, start + row.width * 4),
              y * row.width * 4
            )
          }
          return { slot: row.slot, width: row.width, height: row.height, rgba }
        })
    }
  }
  const participantFrame = popupFrame(participantWindow)
  const raidFrame = popupFrame(raidWindow)
  const developer = {
    getSettings: async () => ({ enabled: true }),
    setEnabled: async (enabled: boolean) => ({ enabled }),
    listSamples: async () => rows.map((row) => ({ ...row })),
    listOcrSamples: async () =>
      rows.map((row) => ({ ...row, remote: { kind: row.source?.kind ?? 'hud', split: 'test' } })),
    closeOcrSamples: async () => undefined,
    readImage: async (id: string) => {
      const row = rows.find((candidate) => candidate.id === id)
      if (row?.source?.kind === 'raid') {
        const svg =
          '<svg xmlns="http://www.w3.org/2000/svg" width="86" height="17"><rect width="86" height="17" fill="#14191e"/><text x="3" y="13" fill="#d4c59a" font-size="11" font-family="sans-serif">테스트공대12</text></svg>'
        return `data:image/svg+xml,${encodeURIComponent(svg)}`
      }
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
      if (!row) {
        throw new Error('DEVELOPER_SAMPLE_NOT_FOUND')
      }
      row.text = text
      return { ...row }
    },
    setSampleExcluded: async (id: string, excluded: boolean) => {
      const row = rows.find((candidate) => candidate.id === id)
      if (!row) {
        throw new Error('DEVELOPER_SAMPLE_NOT_FOUND')
      }
      row.excluded = excluded
      return { ...row }
    },
    captureFrame: async () => ({ pngDataUrl: '', width: 1920, height: 1080 }),
    previewParty: async (kind: DeveloperCollectionKind = 'hud') => ({
      frame:
        scenario === 'capture-error'
          ? null
          : kind === 'raid'
            ? raidFrame
            : kind === 'participants'
              ? participantFrame
              : frame,
      previewError: scenario === 'capture-error' ? 'DEVELOPER_GAME_NOT_FOREGROUND' : null,
      collection: { ...status }
    }),
    setPartyCollectionSlots: async (slots: DeveloperPartySlot[] | null) => {
      status.armed = slots != null
      status.slots = slots ?? []
      return { ...status, slots: [...status.slots] }
    }
  }
  contextBridge.exposeInMainWorld('developer', developer)
}
ipcRenderer.send('ui-fixture-ready')
