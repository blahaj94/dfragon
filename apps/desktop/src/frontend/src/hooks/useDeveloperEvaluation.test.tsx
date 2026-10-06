// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useDeveloperEvaluation } from './useDeveloperEvaluation'
import type { DeveloperSample } from '../../../preload/common/types/developer'
import { OcrWorkerUnavailableError } from '../lib/ocr'

const mocks = vi.hoisted(() => {
  const recognize = vi.fn()
  const terminate = vi.fn()
  const create = vi.fn()
  const read = vi.fn()

  return { recognize, terminate, create, read }
})
vi.mock('../lib/ocr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/ocr')>()
  const createPartyOcrWorker = mocks.create

  return { ...actual, createPartyOcrWorker }
})
vi.mock('../lib/developer-images', () => {
  const readDeveloperImage = mocks.read

  return { readDeveloperImage }
})
let root: ReturnType<typeof createRoot>
let evaluation: ReturnType<typeof useDeveloperEvaluation>
const samples: DeveloperSample[] = [
  {
    id: 'one',
    createdAt: '2026-09-24T00:00:00.000Z',
    width: 10,
    height: 10,
    text: '가',
    excluded: false,
    source: null
  },
  {
    id: 'two',
    createdAt: '2026-09-24T00:00:00.000Z',
    width: 10,
    height: 10,
    text: '나',
    excluded: false,
    source: null
  }
]
function Harness(): null {
  const value = useDeveloperEvaluation()
  useEffect(() => {
    evaluation = value
  }, [value])

  return null
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.create.mockResolvedValue({ recognize: mocks.recognize, terminate: mocks.terminate })
  mocks.recognize.mockResolvedValue({ data: { text: '가', confidence: 80 } })
  mocks.terminate.mockResolvedValue(undefined)
  mocks.read.mockResolvedValue({
    width: 10,
    height: 10,
    getContext: () => {
      const getImageData = (): { data: Uint8ClampedArray } => {
        const data = new Uint8ClampedArray(400)

        return { data }
      }
      const putImageData = vi.fn()

      return { getImageData, putImageData }
    }
  })
  vi.stubGlobal('developer', {
    readImage: vi.fn().mockResolvedValue('data:image/png;base64,fixture')
  })
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<Harness />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

it('같은 모델 worker로 이미지를 직렬 평가하고 끝나면 자원을 해제한다', async () => {
  await act(async () => {
    await evaluation.evaluate(samples)
  })
  expect(mocks.create).toHaveBeenCalledTimes(1)
  expect(mocks.recognize).toHaveBeenCalledTimes(2)
  expect(mocks.terminate).toHaveBeenCalledTimes(1)
  expect(evaluation.progress).toEqual({ done: 2, total: 2 })
  expect(evaluation.results.one).toMatchObject({ status: 'success', text: '가' })
  expect(evaluation.running).toBe(false)
})

it.each(['party', 'raw'] as const)(
  '%s 평가에서 제품 이진화와 원본 입력을 구분한다',
  async (mode) => {
    const original = [10, 20, 30, 100, 110, 120].flatMap((gray) => [gray, gray, gray, 255])
    const pixels = { data: new Uint8ClampedArray(original) }
    const getImageData = vi.fn(() => pixels)
    const putImageData = vi.fn()
    const canvas = { width: 6, height: 1, getContext: () => ({ getImageData, putImageData }) }
    mocks.read.mockResolvedValueOnce(canvas)
    await act(async () => evaluation.setPreprocessing(mode))
    await act(async () => evaluation.evaluate([{ ...samples[0], width: 6, height: 1 }]))

    expect(mocks.recognize).toHaveBeenCalledExactlyOnceWith(canvas)
    expect(canvas).toMatchObject({ width: 6, height: 1 })
    if (mode === 'party') {
      expect([...pixels.data]).toEqual(
        [255, 255, 255, 0, 0, 0].flatMap((gray) => [gray, gray, gray, 255])
      )
      expect(putImageData).toHaveBeenCalledExactlyOnceWith(pixels, 0, 0)
    } else {
      expect([...pixels.data]).toEqual(original)
      expect(getImageData).not.toHaveBeenCalled()
      expect(putImageData).not.toHaveBeenCalled()
    }
  }
)

it('가로로 긴 이미지도 고정 크기 입력을 만드는 worker에 전달한다', async () => {
  const pixels = { data: new Uint8ClampedArray(8192 * 4) }
  const context = { getImageData: () => pixels, putImageData: vi.fn() }
  const canvas = { width: 8192, height: 1, getContext: () => context }
  mocks.read.mockResolvedValueOnce(canvas)
  await act(async () => evaluation.evaluate([{ ...samples[0], width: 8192, height: 1 }]))
  expect(mocks.recognize).toHaveBeenCalledExactlyOnceWith(canvas)
  expect(evaluation.results.one).toMatchObject({ status: 'success' })
})

it('일부 이미지 실패를 표시하고 다음 이미지 평가를 계속한다', async () => {
  mocks.read.mockRejectedValueOnce(new Error('unreadable'))
  await act(async () => {
    await evaluation.evaluate(samples)
  })
  expect(evaluation.results.one).toEqual({ status: 'failed' })
  expect(evaluation.results.two).toMatchObject({ status: 'success' })
})

it('worker 실행 불능은 평가를 중단하고 남은 표본을 실패로 기록하지 않는다', async () => {
  mocks.recognize.mockRejectedValueOnce(new OcrWorkerUnavailableError('PaddleOCR timed out.'))
  await act(async () => evaluation.evaluate(samples))

  expect(evaluation.results).toEqual({})
  expect(evaluation.progress).toEqual({ done: 0, total: 2 })
  expect(evaluation.error).toContain('실행')
  expect(evaluation.running).toBe(false)
  expect(mocks.recognize).toHaveBeenCalledTimes(1)
  expect(mocks.terminate).toHaveBeenCalledTimes(1)

  await act(async () => evaluation.evaluate(samples))
  expect(evaluation.error).toBe('')
  expect(evaluation.progress).toEqual({ done: 2, total: 2 })
})

it('중복 시작을 차단하고 중지 뒤 늦은 결과를 반영하지 않는다', async () => {
  let finish!: (value: { data: { text: string; confidence: number } }) => void
  mocks.recognize
    .mockResolvedValueOnce({ data: { text: '가', confidence: 80 } })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
  let running!: Promise<void>
  await act(async () => {
    running = evaluation.evaluate(samples)
  })
  await act(async () => {
    await evaluation.evaluate(samples)
  })
  expect(mocks.create).toHaveBeenCalledTimes(1)
  await act(async () => evaluation.cancel())
  await act(async () => {
    finish({ data: { text: 'late', confidence: 90 } })
    await running
  })
  expect(evaluation.results.one).toMatchObject({ status: 'success', text: '가' })
  expect(evaluation.results.two).toBeUndefined()
  expect(evaluation.canceled).toBe(true)
  expect(evaluation.progress).toEqual({ done: 1, total: 2 })
  expect(evaluation.running).toBe(false)
  expect(mocks.recognize).toHaveBeenCalledTimes(2)
})

it('평가 중 전처리를 바꾸면 이전 점수를 비우고 늦은 결과를 섞지 않은 채 새 평가를 시작한다', async () => {
  let complete!: (value: { data: { text: string; confidence: number } }) => void
  mocks.recognize
    .mockResolvedValueOnce({ data: { text: '가', confidence: 80 } })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
  let running!: Promise<void>
  await act(async () => {
    running = evaluation.evaluate(samples)
  })
  expect(evaluation.progress).toEqual({ done: 1, total: 2 })
  expect(evaluation.results.one).toMatchObject({ status: 'success', text: '가' })
  const signal = mocks.create.mock.calls[0][0] as AbortSignal

  await act(async () => {
    evaluation.setPreprocessing('raw')
    await running
  })
  expect(signal.aborted).toBe(true)
  expect(evaluation.results).toEqual({})
  expect(evaluation.progress).toEqual({ done: 0, total: 0 })
  expect(evaluation.preprocessing).toBe('raw')
  expect(evaluation.running).toBe(false)

  await act(async () => {
    complete({ data: { text: '이전 전처리의 결과', confidence: 99 } })
  })
  expect(evaluation.results).toEqual({})
  expect(evaluation.progress).toEqual({ done: 0, total: 0 })
  expect(mocks.terminate).toHaveBeenCalledOnce()

  await act(async () => evaluation.evaluate(samples))
  expect(mocks.create).toHaveBeenCalledTimes(2)
  expect(evaluation.results.one).toMatchObject({ status: 'success', text: '가' })
  expect(evaluation.results.two).toMatchObject({ status: 'success', text: '가' })
  expect(evaluation.progress).toEqual({ done: 2, total: 2 })
})

it('모델 초기화 실패 후 새 평가로 복구한다', async () => {
  mocks.create.mockRejectedValueOnce(new Error('initialization failed'))
  await act(async () => evaluation.evaluate(samples))
  expect(evaluation.error).not.toBe('')
  expect(evaluation.running).toBe(false)
  await act(async () => evaluation.evaluate(samples))
  expect(evaluation.error).toBe('')
  expect(evaluation.progress).toEqual({ done: 2, total: 2 })
})

it('취소 후 재시작한 평가에 이전 worker의 늦은 결과를 섞지 않는다', async () => {
  let finish!: (value: { data: { text: string; confidence: number } }) => void
  mocks.recognize.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  let first!: Promise<void>
  await act(async () => {
    first = evaluation.evaluate(samples)
  })
  const firstSignal = mocks.create.mock.calls[0][0] as AbortSignal
  await act(async () => {
    evaluation.cancel()
    await first
    await evaluation.evaluate(samples)
  })
  expect(firstSignal.aborted).toBe(true)
  await act(async () => {
    finish({ data: { text: 'late', confidence: 90 } })
  })
  expect(evaluation.results.one).toMatchObject({ text: '가' })
  expect(evaluation.progress).toEqual({ done: 2, total: 2 })
  expect(evaluation.canceled).toBe(false)
  expect(mocks.terminate).toHaveBeenCalledTimes(2)
})

it('화면을 닫으면 초기화 중인 평가를 취소하고 호출자를 해제한다', async () => {
  let finish!: (value: {
    recognize: typeof mocks.recognize
    terminate: typeof mocks.terminate
  }) => void
  mocks.create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  let running!: Promise<void>
  await act(async () => {
    running = evaluation.evaluate(samples)
  })
  const signal = mocks.create.mock.calls[0][0] as AbortSignal
  await act(async () => {
    root.unmount()
    await running
  })
  expect(signal.aborted).toBe(true)
  await act(async () => {
    finish({ recognize: mocks.recognize, terminate: mocks.terminate })
  })
  expect(mocks.recognize).not.toHaveBeenCalled()
  expect(mocks.terminate).toHaveBeenCalledTimes(1)
})

it.each([
  { name: 'IPC 이미지 읽기', stage: 'ipc', decoded: 0 },
  { name: '이미지 디코딩', stage: 'decode', decoded: 1 }
])(
  '$name 중 중지하면 늦은 이미지로 OCR을 실행하거나 다음 표본을 읽지 않는다',
  async ({ stage, decoded }) => {
    let completeRead!: (value: string) => void
    let completeDecode!: (value: HTMLCanvasElement) => void
    if (stage === 'ipc') {
      vi.mocked(window.developer.readImage).mockReturnValueOnce(
        new Promise<string>((resolve) => {
          completeRead = resolve
        })
      )
    } else {
      mocks.read.mockReturnValueOnce(
        new Promise<HTMLCanvasElement>((resolve) => {
          completeDecode = resolve
        })
      )
    }
    let running!: Promise<void>
    await act(async () => {
      running = evaluation.evaluate(samples)
    })
    expect(window.developer.readImage).toHaveBeenCalledExactlyOnceWith('one')
    expect(mocks.read).toHaveBeenCalledTimes(decoded)
    const signal = mocks.create.mock.calls[0][0] as AbortSignal

    await act(async () => {
      evaluation.cancel()
      await running
    })
    expect(signal.aborted).toBe(true)
    expect(evaluation.canceled).toBe(true)
    expect(evaluation.running).toBe(false)

    await act(async () => {
      if (stage === 'ipc') {
        completeRead('data:image/png;base64,late-image')
      } else {
        completeDecode(document.createElement('canvas'))
      }
    })

    expect(evaluation.results).toEqual({})
    expect(evaluation.progress).toEqual({ done: 0, total: 2 })
    expect(window.developer.readImage).toHaveBeenCalledOnce()
    expect(mocks.read).toHaveBeenCalledTimes(decoded)
    expect(mocks.recognize).not.toHaveBeenCalled()
    expect(mocks.terminate).toHaveBeenCalledOnce()
  }
)
