// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useRaidCapture } from './useRaidCapture'
import { emptySearchSlots } from '../lib/slots'
import type { RaidSlotRecognition } from '../lib/raid-recognition'
import { searchSnapshot } from '../../../preload/api/search-test-fixture'
import type { RaidFrameResult } from '../../../preload/common/types/capture'
import type { SearchApi, SearchSnapshot } from '../../../preload/common/types/search'

const raidMocks = vi.hoisted(() => ({ recognize: vi.fn() }))
vi.mock('../lib/raid-recognition', () => ({ recognizeRaidRows: raidMocks.recognize }))
// 글자 인식 worker는 jsdom에서 띄울 수 없어 인식 결과만 테스트가 정한다.
vi.mock('../lib/ocr', () => ({
  createPartyOcrWorker: async () => ({ recognize: vi.fn(), terminate: async () => {} })
}))

const crop = { width: 86, height: 17, rgba: new Uint8Array(86 * 17 * 4) }
const frame: RaidFrameResult = {
  kind: 'rows',
  valueColumn: 'fame',
  rows: Array.from({ length: 12 }, (_, row) =>
    row === 0 ? { nickname: crop, job: crop, valueText: '12,345' } : null
  )
}
const recognized: RaidSlotRecognition[] = [
  { kind: 'recognized', nickname: '첫째공대원', slot: 0, jobText: '眞 크루세이더' },
  ...Array.from({ length: 11 }, (_, index) => ({ kind: 'missing' as const, slot: index + 1 }))
]
let value: ReturnType<typeof useRaidCapture>
let root: Root

function Harness(): null {
  const current = useRaidCapture({ sourceId: 'game', sourceReady: true, receivesShortcut: false })
  useLayoutEffect(() => {
    value = current
  })

  return null
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let snapshot: SearchSnapshot = searchSnapshot({ captureId: null, slots: emptySearchSlots(12) })
  vi.stubGlobal('raidSearch', {
    controlCharacterSearch: vi.fn<SearchApi['controlCharacterSearch']>(async (command) => {
      if (command.action === 'begin') {
        snapshot = {
          ...snapshot,
          captureId: '00000000-0000-4000-8000-000000000901',
          revision: snapshot.revision + 1
        }
      }

      return { ok: true, snapshot }
    }),
    onCharacterSearchChanged: vi.fn<SearchApi['onCharacterSearchChanged']>(() => () => {}),
    notifyOcrCandidatesDetected: vi.fn(async () => ({ ok: true, snapshot })),
    readCaptureFrame: vi.fn(async () => frame)
  })
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<Harness />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('공대 회차가 인식하는 동안 자리 맞바꾸기 요청을 거절하고, 인식을 마치면 다시 받는다', async () => {
  const late = Promise.withResolvers<RaidSlotRecognition[]>()
  raidMocks.recognize.mockReturnValueOnce(late.promise)
  let swapped: boolean | undefined
  await act(async () => {
    swapped = value.swapSeats(0, 1)
  })
  expect(swapped).toBe(true)
  expect(value.seatOrder.slice(0, 2)).toEqual([1, 0])

  await act(async () => value.startRound())
  await vi.waitFor(() => expect(raidMocks.recognize).toHaveBeenCalledOnce())
  // 회차는 배치를 처음으로 되돌린다.
  expect(value.seatOrder.slice(0, 2)).toEqual([0, 1])
  expect(value.canMoveSeats).toBe(false)
  // 화면이 막지 않고 요청해도 hook이 다시 검사해 거절한다.
  await act(async () => {
    swapped = value.swapSeats(0, 1)
  })
  expect(swapped).toBe(false)
  expect(value.seatOrder.slice(0, 2)).toEqual([0, 1])

  await act(async () => late.resolve(recognized))
  await vi.waitFor(() => expect(value.canMoveSeats).toBe(true))
  await act(async () => {
    swapped = value.swapSeats(0, 1)
  })
  expect(swapped).toBe(true)
  expect(value.seatOrder.slice(0, 2)).toEqual([1, 0])
  await act(async () => {
    swapped = value.swapSeats(3, 3)
  })
  expect(swapped).toBe(false)
})
