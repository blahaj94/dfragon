import { vi } from 'vitest'
import { emptySearchSlots } from '../../lib/slots'
import { searchSnapshot } from '../../../../preload/api/search-test-fixture'
import {
  SEARCH_SLOT_COUNTS,
  type SearchApi,
  type SearchSlotCount
} from '../../../../preload/common/types/search'

function idleSearch(slotCount: SearchSlotCount): SearchApi {
  const snapshot = searchSnapshot({ captureId: null, slots: emptySearchSlots(slotCount) })

  return {
    controlCharacterSearch: vi.fn<SearchApi['controlCharacterSearch']>(async () => ({
      ok: true,
      snapshot
    })),
    onCharacterSearchChanged: vi.fn<SearchApi['onCharacterSearchChanged']>(() => () => {})
  }
}

export function stubIdleDesktopBridges(): void {
  vi.stubGlobal('manualSearch', idleSearch(SEARCH_SLOT_COUNTS.party))
  vi.stubGlobal('raidSearch', {
    ...idleSearch(SEARCH_SLOT_COUNTS.raid),
    notifyOcrCandidatesDetected: vi.fn(async () => {
      throw new Error('Idle raid search does not accept OCR')
    }),
    readCaptureFrame: vi.fn(async () => {
      throw new Error('Idle raid search has no capture frames')
    })
  } satisfies Window['raidSearch'])
  vi.stubGlobal('desktopShortcut', {
    onDesktopShortcut: vi.fn(() => () => {})
  } satisfies Window['desktopShortcut'])
  vi.stubGlobal('updateNotice', {
    getUpdateNotice: vi.fn(async () => ({ revision: 0, notice: null })),
    dismissUpdateNotice: vi.fn(async () => ({ revision: 0, notice: null })),
    openUpdateRelease: vi.fn(async () => {}),
    onUpdateNoticeChanged: vi.fn(() => () => {})
  } satisfies Window['updateNotice'])
  vi.stubGlobal('windowChrome', {
    setContentHeight: vi.fn(async () => {})
  } satisfies Window['windowChrome'])
}
