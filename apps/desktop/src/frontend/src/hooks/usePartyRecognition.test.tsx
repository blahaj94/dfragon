// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterPortrait } from '../../../preload/common/types/character'
import type { PartyOcrResult, PartyOcrWorker } from '../types/capture'
import {
  capturePartyNicknameCrops,
  capturePartyRecognitionInputs,
  type PartyRecognitionInput
} from '../lib/party'
import { usePartyRecognition } from './usePartyRecognition'

vi.mock('../lib/party', () => ({
  capturePartyNicknameCrops: vi.fn(),
  capturePartyRecognitionInputs: vi.fn()
}))

const mounted: (() => void)[] = []

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true
  })
})

afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((unmount) => unmount()))
})

async function fixture(mode: 'legacy' | 'identify' = 'identify'): Promise<{
  cycle: (controller?: AbortController) => Promise<void>
  startCycle: (controller?: AbortController) => Promise<void>
  current: () => ReturnType<typeof usePartyRecognition>
  worker: PartyOcrWorker & { recognize: ReturnType<typeof vi.fn<PartyOcrWorker['recognize']>> }
  observe: ReturnType<typeof vi.fn>
  observeOcr: ReturnType<typeof vi.fn>
  setFrame: (portrait?: CharacterPortrait | null) => void
}> {
  const observe = vi.fn()
  const observeOcr = vi.fn()
  let current: ReturnType<typeof usePartyRecognition> | undefined
  const video = document.createElement('video')
  const nickname = document.createElement('canvas')
  const worker = {
    recognize: vi.fn<PartyOcrWorker['recognize']>().mockResolvedValue(ocrResult('가나', '가너')),
    terminate: vi.fn<PartyOcrWorker['terminate']>().mockResolvedValue(undefined)
  }
  const root = createRoot(document.createElement('div'))
  mounted.push(() => root.unmount())

  function Harness(): null {
    const identify = mode === 'identify' ? observeOcr : undefined
    current = usePartyRecognition(observe, identify)

    return null
  }

  function readCurrent(): ReturnType<typeof usePartyRecognition> {
    if (current == null) {
      throw new Error('Recognition hook did not render.')
    }

    return current
  }

  function setFrame(portrait: CharacterPortrait | null = null): void {
    const input: PartyRecognitionInput = { slot: 0, nickname, portrait }
    vi.mocked(capturePartyRecognitionInputs).mockReturnValue([input, null, null, null])
    vi.mocked(capturePartyNicknameCrops).mockReturnValue([nickname, null, null, null])
  }

  setFrame()
  await act(async () => root.render(<Harness />))

  return {
    cycle: async (controller = new AbortController()) => {
      await act(async () => readCurrent().recognizePartyNicknames(video, worker, controller.signal))
    },
    startCycle: (controller = new AbortController()) =>
      readCurrent().recognizePartyNicknames(video, worker, controller.signal),
    current: readCurrent,
    worker,
    observe,
    observeOcr,
    setFrame
  }
}

function ocrResult(...names: string[]): { data: PartyOcrResult } {
  const candidates = names.map((nickname, index) => ({
    nickname,
    rank: index + 1,
    modelScore: 0.1
  }))
  const text = names[0] ?? ''

  return { data: { text, confidence: 0.1, candidates } }
}

function portrait(maskedValue = 20): CharacterPortrait {
  return {
    image: {
      width: 2,
      height: 1,
      rgba: new Uint8Array([10, 10, 10, 255, maskedValue, 20, 20, 255])
    },
    validMask: new Uint8Array([1, 0]),
    rasterScale: 1
  }
}

describe('OCR 식별 입력 안정화', () => {
  it('같은 프레임 입력을 두 번 관측한 뒤 낮은 모델 점수와 관계없이 원문 후보 두 개를 전달한다', async () => {
    const f = await fixture()
    f.worker.recognize.mockResolvedValue(ocrResult('검사*', '검사☆'))
    f.setFrame(portrait())

    await f.cycle()
    expect(f.observeOcr).not.toHaveBeenCalled()
    expect(f.current().stableNicknames[0]).toBeNull()
    await f.cycle()

    expect(f.observeOcr.mock.calls).toEqual([
      [{ slot: 0, nickname: '검사*', candidateNicknames: ['검사*', '검사☆'], portrait: portrait() }]
    ])
    expect(f.current().stableNicknames[0]).toBe('검사*')
    expect(capturePartyRecognitionInputs).toHaveBeenCalledTimes(2)
  })

  it('유효하지 않은 이름과 중복만 제외하고 한 글자, 특수문자와 Unicode 원문을 보존한다', async () => {
    const f = await fixture()
    f.worker.recognize.mockResolvedValue(
      ocrResult('', ' 가나', '가나 ', 'a'.repeat(13), '\uD800', '😀', '😀', '별*')
    )

    await f.cycle()
    await f.cycle()

    expect(f.observeOcr).toHaveBeenCalledWith({
      slot: 0,
      nickname: '😀',
      candidateNicknames: ['😀', '별*'],
      portrait: null
    })
    expect(f.current().stableNicknames[0]).toBe('😀')
  })

  it.each([
    ['첫 후보', ['다라', '가너']],
    ['두 번째 후보', ['가나', '가니']],
    ['후보 순서', ['가너', '가나']]
  ])('%s가 바뀌면 이전 슬롯을 즉시 비우고 새 입력 두 번을 기다린다', async (_, names) => {
    const f = await fixture()
    await f.cycle()
    await f.cycle()
    f.worker.recognize.mockResolvedValue(ocrResult(...names))

    await f.cycle()
    expect(f.observe).toHaveBeenCalledExactlyOnceWith({ slot: 0, nickname: null })
    expect(f.current().stableNicknames[0]).toBeNull()
    expect(f.observeOcr).toHaveBeenCalledTimes(1)
    await f.cycle()

    expect(f.observeOcr).toHaveBeenLastCalledWith({
      slot: 0,
      nickname: names[0],
      candidateNicknames: names,
      portrait: null
    })
    expect(f.current().stableNicknames[0]).toBe(names[0])
  })

  it('얼굴이 없어도 안정된 이름을 전달하고 얼굴을 확보하면 새 관측 두 번 뒤 다시 전달한다', async () => {
    const f = await fixture()
    await f.cycle()
    await f.cycle()
    expect(f.observeOcr).toHaveBeenLastCalledWith({
      slot: 0,
      nickname: '가나',
      candidateNicknames: ['가나', '가너'],
      portrait: null
    })
    f.setFrame(portrait())

    await f.cycle()
    expect(f.observe).toHaveBeenCalledWith({ slot: 0, nickname: null })
    expect(f.observeOcr).toHaveBeenCalledTimes(1)
    await f.cycle()

    expect(f.observeOcr).toHaveBeenCalledTimes(2)
    expect(f.observeOcr.mock.lastCall?.[0].portrait).toEqual(portrait())
  })

  it('가려진 픽셀만 바뀌면 안정화와 기존 결과를 유지하지만 유효한 얼굴이 바뀌면 비운다', async () => {
    const f = await fixture()
    f.setFrame(portrait())
    await f.cycle()
    f.setFrame(portrait(90))
    await f.cycle()
    f.setFrame(portrait(120))
    await f.cycle()

    expect(f.observeOcr).toHaveBeenCalledTimes(1)
    expect(f.observe).not.toHaveBeenCalled()
    expect(f.current().stableNicknames[0]).toBe('가나')
    const changed = portrait()
    changed.image.rgba[0] = 11
    f.setFrame(changed)
    await f.cycle()
    expect(f.observe).toHaveBeenCalledWith({ slot: 0, nickname: null })
    expect(f.current().stableNicknames[0]).toBeNull()
  })

  it.each(['빈 OCR', '프레임 없음'])(
    '%s은 이전 결과를 비우고 다시 나타난 이름의 안정화를 초기화한다',
    async (reason) => {
      const f = await fixture()
      await f.cycle()
      await f.cycle()
      if (reason === '빈 OCR') {
        f.worker.recognize.mockResolvedValue(ocrResult())
      } else {
        vi.mocked(capturePartyRecognitionInputs).mockReturnValue([null, null, null, null])
      }

      await f.cycle()
      expect(f.observe).toHaveBeenCalledExactlyOnceWith({ slot: 0, nickname: null })
      expect(f.current().stableNicknames[0]).toBeNull()
      f.worker.recognize.mockResolvedValue(ocrResult('가나', '가너'))
      f.setFrame()
      await f.cycle()
      expect(f.observeOcr).toHaveBeenCalledTimes(1)
      await f.cycle()
      expect(f.observeOcr).toHaveBeenCalledTimes(2)
    }
  )

  it.each(['abort', 'reset'])(
    '%s 이후 늦게 끝난 OCR은 통지하지 않고 다음 슬롯도 읽지 않는다',
    async (action) => {
      const f = await fixture()
      await f.cycle()
      const firstInput = vi.mocked(capturePartyRecognitionInputs).mock.results[0].value[0]
      vi.mocked(capturePartyRecognitionInputs).mockReturnValue([
        firstInput,
        { slot: 1, nickname: document.createElement('canvas'), portrait: null },
        null,
        null
      ])
      const pending = Promise.withResolvers<{ data: PartyOcrResult }>()
      f.worker.recognize.mockReturnValueOnce(pending.promise)
      const controller = new AbortController()
      const cycle = f.cycle(controller)
      if (action === 'abort') {
        controller.abort()
      } else {
        await act(async () => f.current().resetRecognition())
      }
      pending.resolve(ocrResult('가나', '가너'))
      await cycle

      expect(f.observeOcr).not.toHaveBeenCalled()
      expect(f.observe).not.toHaveBeenCalled()
      expect(f.worker.recognize).toHaveBeenCalledTimes(2)
      expect(f.current().stableNicknames[0]).toBeNull()
      if (action === 'reset') {
        f.setFrame()
        await f.cycle()
        expect(f.observeOcr).not.toHaveBeenCalled()
        await f.cycle()
        expect(f.observeOcr).toHaveBeenCalledTimes(1)
      }
    }
  )
})

describe.each(['legacy', 'identify'] as const)('%s 프레임의 사라진 파티원 처리', (mode) => {
  function setSlots(...slots: number[]): void {
    const crops = Array.from({ length: 4 }, (_, slot) => {
      if (slots.includes(slot)) {
        return document.createElement('canvas')
      }

      return null
    })
    vi.mocked(capturePartyNicknameCrops).mockReturnValue(crops)
    const inputs = crops.map((nickname, slot) => {
      if (nickname === null) {
        return null
      }

      return { slot, nickname, portrait: null }
    })
    vi.mocked(capturePartyRecognitionInputs).mockReturnValue(inputs)
  }

  it('뒤 슬롯은 앞 슬롯 OCR을 기다리기 전에 비우고 재등장 시 두 번 안정화한다', async () => {
    const f = await fixture(mode)
    setSlots(0, 3)
    await f.cycle()
    await f.cycle()
    expect(f.current().stableNicknames).toEqual(['가나', null, null, '가나'])
    f.observe.mockClear()
    f.observeOcr.mockClear()
    setSlots(0)
    const pending = Promise.withResolvers<{ data: PartyOcrResult }>()
    f.worker.recognize.mockReturnValueOnce(pending.promise)
    let cycle!: Promise<void>

    try {
      await act(async () => {
        cycle = f.startCycle()
      })
      expect(f.observe).toHaveBeenCalledExactlyOnceWith({ slot: 3, nickname: null })
      expect(f.current().stableNicknames).toEqual(['가나', null, null, null])
    } finally {
      await act(async () => {
        pending.resolve(ocrResult('가나', '가너'))
        await cycle
      })
    }

    await f.cycle()
    expect(f.observe).toHaveBeenCalledExactlyOnceWith({ slot: 3, nickname: null })
    setSlots(0, 3)
    await f.cycle()
    expect(f.current().stableNicknames[3]).toBeNull()
    const notify = mode === 'identify' ? f.observeOcr : f.observe
    expect(
      notify.mock.calls.filter(([input]) => input.slot === 3 && input.nickname != null)
    ).toEqual([])
    await f.cycle()
    expect(f.current().stableNicknames[3]).toBe('가나')
    expect(
      notify.mock.calls.filter(([input]) => input.slot === 3 && input.nickname === '가나')
    ).toHaveLength(1)
  })

  it.each(['abort', 'reset'] as const)(
    '%s 이후 앞 슬롯의 늦은 응답이 초기화된 관측을 복원하지 않는다',
    async (action) => {
      const f = await fixture(mode)
      setSlots(0, 3)
      await f.cycle()
      const pending = Promise.withResolvers<{ data: PartyOcrResult }>()
      f.worker.recognize.mockReturnValueOnce(pending.promise)
      const controller = new AbortController()
      let cycle!: Promise<void>
      await act(async () => {
        cycle = f.startCycle(controller)
        if (action === 'abort') {
          controller.abort()
        } else {
          f.current().resetRecognition()
        }
      })
      await act(async () => {
        pending.resolve(ocrResult('가나', '가너'))
        await cycle
      })
      expect(f.observe).not.toHaveBeenCalled()
      expect(f.observeOcr).not.toHaveBeenCalled()
      expect(f.current().stableNicknames).toEqual([null, null, null, null])
      expect(f.worker.recognize).toHaveBeenCalledTimes(3)
    }
  )
})
