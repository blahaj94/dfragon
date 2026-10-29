import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, vi, type Mocked } from 'vitest'
import type { WindowFrameResult } from '../../../../preload/common/types/capture'
import type { DesktopShortcutApi } from '../../../../preload/common/types/desktop-shortcut'
import type { SearchSnapshot } from '../../../../preload/common/types/search'
import {
  CAPTURE_ID,
  searchSlot,
  searchSnapshot,
  type SearchTestApi,
  type ObservationTestApi
} from '../../../../preload/api/search-test-fixture'
import type { PartyOcrWorker } from '../../types/capture'
import type { CharacterImage } from '../../../../preload/common/types/character'

const media = vi.hoisted(() => {
  const crops = vi.fn()
  const worker = vi.fn()

  return { crops, worker }
})
vi.mock('../../lib/ocr', async (original) => {
  const originalModule = await original<typeof import('../../lib/ocr')>()

  return {
    ...originalModule,
    createPartyOcrWorker: media.worker
  }
})
vi.mock('../../lib/party', async (original) => {
  const originalModule = await original<typeof import('../../lib/party')>()

  return {
    ...originalModule,
    capturePartyRecognitionInputs: (frame: CharacterImage) =>
      media.crops(frame).map((nickname: HTMLCanvasElement | null, slot: number) => {
        if (nickname === null) {
          return null
        }

        return { slot, nickname, portrait: null }
      })
  }
})
const cleanup: Array<() => Promise<void>> = []

type CaptureResources = {
  frame: WindowFrameResult
  worker: {
    recognize: ReturnType<typeof vi.fn<PartyOcrWorker['recognize']>>
    terminate: ReturnType<typeof vi.fn<PartyOcrWorker['terminate']>>
  }
}
type RendererFixture = {
  container: HTMLDivElement
  search: Mocked<SearchTestApi>
  capture: {
    listCaptureSources: ReturnType<typeof vi.fn>
    selectCaptureSource: ReturnType<typeof vi.fn>
    readCaptureFrame: ReturnType<typeof vi.fn>
    notifyOcrCandidatesDetected: Mocked<ObservationTestApi>['notifyOcrCandidatesDetected']
    onDesktopShortcut: Mocked<DesktopShortcutApi>['onDesktopShortcut']
  }
  resources: CaptureResources
  readCaptureFrame: ReturnType<typeof vi.fn>
  mount: (content: ReactNode) => Promise<void>
  unmount: () => Promise<void>
  restart: () => Promise<void>
  current: () => SearchSnapshot
}

export function captureResources(): CaptureResources {
  const frame: WindowFrameResult = {
    kind: 'frame',
    image: { width: 1920, height: 1080, rgba: new Uint8Array(1920 * 1080 * 4) }
  }
  const worker = {
    recognize: vi.fn<PartyOcrWorker['recognize']>().mockResolvedValue({
      candidates: [{ rank: 1, modelScore: 90, nickname: 'ALICE' }]
    }),
    terminate: vi.fn<PartyOcrWorker['terminate']>()
  }

  return { frame, worker }
}

export function createRendererFixture(): RendererFixture {
  const container = document.createElement('div')
  document.body.append(container)
  const root: Root = createRoot(container)
  let mounted = true
  let currentSearch = searchSnapshot({ captureId: null, revision: 0 })
  let sequence = 0
  const resources = captureResources()
  const readCaptureFrame = vi.fn().mockResolvedValue(resources.frame)
  const search = {
    controlCharacterSearch: vi
      .fn<SearchTestApi['controlCharacterSearch']>()
      .mockImplementation(async (command) => {
        const isBegin = command.action === 'begin'
        if (isBegin) {
          sequence += 1
          const isFirstCapture = sequence === 1
          const captureId = isFirstCapture
            ? CAPTURE_ID
            : `00000000-0000-4000-8000-${String(100 + sequence).padStart(12, '0')}`
          currentSearch = searchSnapshot({ captureId, revision: currentSearch.revision + 1 })
        }

        return { ok: true, snapshot: currentSearch }
      }),
    onCharacterSearchChanged: vi
      .fn<SearchTestApi['onCharacterSearchChanged']>()
      .mockReturnValue(() => {})
  }
  const capture = {
    onDesktopShortcut: vi.fn<DesktopShortcutApi['onDesktopShortcut']>().mockReturnValue(() => {}),
    readCaptureFrame,
    listCaptureSources: vi.fn().mockResolvedValue([
      { id: 'game', name: 'Synthetic game' },
      { id: 'next', name: 'Next game' }
    ]),
    selectCaptureSource: vi.fn(async (sourceId: string) => {
      if (sourceId === '') {
        return null
      }
      const name = sourceId === 'game' ? 'Synthetic game' : 'Next game'

      return { id: sourceId, name }
    }),
    notifyOcrCandidatesDetected: vi
      .fn<ObservationTestApi['notifyOcrCandidatesDetected']>()
      .mockImplementation(async (observation) => {
        const slots = currentSearch.slots.map((slot) => {
          if (slot.slot !== observation.slot) {
            return slot
          }

          return searchSlot({
            slot: observation.slot,
            nickname: observation.nickname,
            observationRevision: observation.observationRevision,
            state: 'pending',
            rows: []
          })
        })
        currentSearch = { ...currentSearch, revision: currentSearch.revision + 1, slots }

        return { ok: true, snapshot: currentSearch }
      })
  }
  Object.defineProperty(window, 'api', { configurable: true, value: capture })
  Object.defineProperty(window, 'desktopShortcut', {
    configurable: true,
    value: { onDesktopShortcut: capture.onDesktopShortcut }
  })
  Object.defineProperty(window, 'search', { configurable: true, value: search })
  media.worker.mockResolvedValue(resources.worker)
  media.crops.mockReturnValue([null, null, null, null])

  async function unmount(): Promise<void> {
    if (mounted) {
      mounted = false
      await act(async () => root.unmount())
      container.remove()
    }
  }
  cleanup.push(unmount)

  return {
    container,
    search,
    capture,
    resources,
    readCaptureFrame,
    mount: async (content) => {
      await act(async () => root.render(content))
    },
    unmount,
    restart: async () => {
      await act(async () => capture.onDesktopShortcut.mock.lastCall![0]('restart-search'))
    },
    current: () => currentSearch
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})
afterEach(async () => {
  for (const dispose of cleanup.splice(0)) {
    await dispose()
  }
  vi.restoreAllMocks()
})

export { media }
