// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterPortrait } from '../../../preload/common/types/character'
import type { PartyOcrResult, PartyOcrWorker } from '../types/capture'
import {
  capturePartyNicknameCrops,
  capturePartyRecognitionInputs,
  type PartyFrameSource,
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
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function fixture(mode: 'legacy' | 'identify' = 'identify'): Promise<{
  cycle: (controller?: AbortController, frame?: PartyFrameSource) => Promise<void>
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
  const defaultFrame: PartyFrameSource = { width: 1, height: 1, rgba: new Uint8Array(4) }
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
    cycle: async (controller = new AbortController(), frame = defaultFrame) => {
      await act(async () => readCurrent().recognizePartyNicknames(frame, worker, controller.signal))
    },
    startCycle: (controller = new AbortController()) =>
      readCurrent().recognizePartyNicknames(defaultFrame, worker, controller.signal),
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

describe('OCR 조회 라운드', () => {
  it('안정화용 반복 OCR은 최초 프레임만 업로드하고 새 라운드에서 다시 수집한다', async () => {
    const collect = vi.fn().mockResolvedValue({ status: 'queued' })
    vi.stubGlobal('ocrCollection', { collectOcrSample: collect })
    const f = await fixture()
    const frame = {
      width: 1,
      height: 1,
      rgba: new Uint8Array(4),
      captureId: 'round-one',
      frameId: 'frame-one'
    }
    await f.cycle(undefined, frame)
    await f.cycle(undefined, { ...frame, frameId: 'frame-two' })
    expect(collect).toHaveBeenCalledExactlyOnceWith({
      captureId: 'round-one',
      frameId: 'frame-one',
      slot: 1,
      prediction: '가나'
    })
    await act(async () => f.current().resetRecognition())
    await f.cycle(undefined, { ...frame, captureId: 'round-two', frameId: 'frame-three' })
    expect(collect).toHaveBeenLastCalledWith({
      captureId: 'round-two',
      frameId: 'frame-three',
      slot: 1,
      prediction: '가나'
    })
  })

  it('업로드 실패는 OCR 검색을 차단하지 않고 빈 인식도 원본 프레임을 수집한다', async () => {
    const collect = vi.fn().mockRejectedValue(new Error('upload unavailable'))
    vi.stubGlobal('ocrCollection', { collectOcrSample: collect })
    const f = await fixture()
    f.worker.recognize.mockResolvedValue(ocrResult())
    await f.cycle(undefined, {
      width: 1,
      height: 1,
      rgba: new Uint8Array(4),
      captureId: 'round',
      frameId: 'frame'
    })
    expect(collect).toHaveBeenCalledWith({
      captureId: 'round',
      frameId: 'frame',
      slot: 1,
      prediction: null
    })
    expect(f.observeOcr).toHaveBeenCalledOnce()
    expect(f.current().recognitionStates[0]).toBe('failure')
  })

  it('첫 후보만 두 번 안정화한 뒤 전달하고 낮은 순위의 변경은 무시한다', async () => {
    const f = await fixture()
    f.worker.recognize.mockResolvedValueOnce(ocrResult('검사*', '검사☆'))
    f.worker.recognize.mockResolvedValue(ocrResult('검사*', '다른후보'))
    f.setFrame(portrait())
    await f.cycle()
    expect(f.current().recognitionStates[0]).toBe('pending')
    expect(f.observeOcr).not.toHaveBeenCalled()
    await f.cycle()
    expect(f.observeOcr).toHaveBeenCalledExactlyOnceWith({
      slot: 0,
      nickname: '검사*',
      candidateNicknames: ['검사*'],
      portrait: portrait()
    })
    expect(f.current().recognitionStates[0]).toBe('complete')
  })

  it('첫 후보의 앞뒤 공백을 제거한 이름으로 안정화해 전달하고 Console에 남기지 않는다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = await fixture()
    f.worker.recognize.mockResolvedValueOnce(ocrResult(' 가나', '정상후보'))
    f.worker.recognize.mockResolvedValueOnce(ocrResult('가나 ', '정상후보'))
    await f.cycle()
    await f.cycle()
    expect(f.observeOcr).toHaveBeenCalledExactlyOnceWith({
      slot: 0,
      nickname: '가나',
      candidateNicknames: ['가나'],
      portrait: null
    })
    expect(f.current().stableNicknames[0]).toBe('가나')
    expect(warn).not.toHaveBeenCalled()
  })

  it('자료 수집은 앞뒤 공백을 제거하지 않은 모델 원문을 올린다', async () => {
    const collect = vi
      .fn<typeof window.ocrCollection.collectOcrSample>()
      .mockResolvedValue({ status: 'queued' })
    vi.stubGlobal('ocrCollection', { collectOcrSample: collect })
    const f = await fixture()
    f.worker.recognize.mockResolvedValue(ocrResult(' 가나'))
    await f.cycle(undefined, {
      width: 1,
      height: 1,
      rgba: new Uint8Array(4),
      captureId: 'round',
      frameId: 'frame'
    })
    expect(collect).toHaveBeenCalledExactlyOnceWith({
      captureId: 'round',
      frameId: 'frame',
      slot: 1,
      prediction: ' 가나'
    })
  })

  it('앞뒤 공백을 제거한 12자 이름은 최대 길이 안에서 전달한다', async () => {
    const f = await fixture()
    const nickname = 'a'.repeat(12)
    f.worker.recognize.mockResolvedValue(ocrResult(` ${nickname} `))
    await f.cycle()
    await f.cycle()
    expect(f.observeOcr).toHaveBeenCalledExactlyOnceWith({
      slot: 0,
      nickname,
      candidateNicknames: [nickname],
      portrait: null
    })
  })

  it.each([
    ['', '이유: 빈 문자열, 원문: ""'],
    ['  ', '이유: 빈 문자열, 원문: "  "'],
    ['a'.repeat(13), '이유: 최대 길이 초과, 원문: "aaaaaaaaaaaaa"'],
    ['\uD800', '이유: 잘못된 Unicode, 원문: "\\ud800"']
  ])(
    '첫 후보 %j가 유효하지 않으면 두 번째 후보로 대체하지 않고 조회 실패와 원문을 Console에 남긴다',
    async (first, message) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const f = await fixture()
      f.worker.recognize.mockResolvedValue(ocrResult(first, '정상후보'))
      await f.cycle()
      await f.cycle()
      expect(f.observeOcr).toHaveBeenCalledExactlyOnceWith({
        slot: 0,
        nickname: '',
        candidateNicknames: [''],
        portrait: null
      })
      expect(f.current().recognitionStates[0]).toBe('failure')
      expect(f.worker.recognize).toHaveBeenCalledTimes(1)
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0][0]).toContain('슬롯 1의 OCR 첫 후보를 검색에 쓰지 못했습니다.')
      expect(warn.mock.calls[0][0]).toContain(message)
    }
  )

  it('빈 후보 목록도 완료된 조회 실패로 처리하고 후보가 없었음을 Console에 남긴다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = await fixture()
    f.worker.recognize.mockResolvedValue(ocrResult())
    await f.cycle()
    expect(f.current().recognitionStates[0]).toBe('failure')
    expect(f.current().stableNicknames[0]).toBeNull()
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('이유: 후보 없음, 원문: 없음')
    )
  })

  it('완료 후 이름과 얼굴이 바뀌거나 창이 가려져도 OCR과 검색을 다시 실행하지 않는다', async () => {
    const f = await fixture()
    await f.cycle()
    await f.cycle()
    f.worker.recognize.mockResolvedValue(ocrResult('새파티원'))
    f.setFrame(portrait())
    await f.cycle()
    vi.mocked(capturePartyRecognitionInputs).mockReturnValue([null, null, null, null])
    await f.cycle()
    expect(f.current().stableNicknames[0]).toBe('가나')
    expect(f.observe).not.toHaveBeenCalled()
    expect(f.observeOcr).toHaveBeenCalledTimes(1)
    expect(f.worker.recognize).toHaveBeenCalledTimes(2)
  })

  it('라운드를 초기화하면 모든 결과를 지우고 첫 후보부터 다시 인식한다', async () => {
    const f = await fixture()
    await f.cycle()
    await f.cycle()
    await act(async () => f.current().resetRecognition())
    expect(f.current().recognitionStates).toEqual(['idle', 'idle', 'idle', 'idle'])
    expect(f.current().stableNicknames).toEqual([null, null, null, null])
    f.worker.recognize.mockResolvedValue(ocrResult('새파티원'))
    await f.cycle()
    await f.cycle()
    expect(f.observeOcr).toHaveBeenLastCalledWith({
      slot: 0,
      nickname: '새파티원',
      candidateNicknames: ['새파티원'],
      portrait: null
    })
  })

  it('제외한 얼굴 픽셀의 변화는 첫 조회 안정화를 방해하지 않는다', async () => {
    const f = await fixture()
    f.setFrame(portrait())
    await f.cycle()
    f.setFrame(portrait(90))
    await f.cycle()
    expect(f.observeOcr).toHaveBeenCalledTimes(1)
  })

  it.each(['abort', 'reset'] as const)(
    '%s 이후 늦게 끝난 OCR은 새 라운드에 영향을 주지 않는다',
    async (action) => {
      const f = await fixture()
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
        pending.resolve(ocrResult('가나'))
        await cycle
      })
      expect(f.observeOcr).not.toHaveBeenCalled()
      expect(f.current().stableNicknames[0]).toBeNull()
    }
  )
})

describe.each(['legacy'] as const)('%s 프레임의 사라진 파티원 처리', (mode) => {
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
    const notify = f.observe
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
