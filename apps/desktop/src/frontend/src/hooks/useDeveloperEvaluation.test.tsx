// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useDeveloperEvaluation } from './useDeveloperEvaluation'
import type { DeveloperSample } from '../../../preload/common/types/developer'

const mocks = vi.hoisted(() => ({
  recognize: vi.fn(),
  terminate: vi.fn(),
  create: vi.fn(),
  read: vi.fn()
}))
vi.mock('../lib/ocr', () => ({ createPartyOcrWorker: mocks.create }))
vi.mock('../lib/developer-images', () => ({ readDeveloperImage: mocks.read }))
let root: ReturnType<typeof createRoot>
let evaluation: ReturnType<typeof useDeveloperEvaluation>
const samples: DeveloperSample[] = [
  { id: 'one', createdAt: '2026-09-24T00:00:00.000Z', width: 10, height: 10, text: '가' },
  { id: 'two', createdAt: '2026-09-24T00:00:00.000Z', width: 10, height: 10, text: '나' }
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
    getContext: () => ({
      getImageData: () => ({ data: new Uint8ClampedArray(400) }),
      putImageData: vi.fn()
    })
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

it('일부 이미지 실패를 표시하고 다음 이미지 평가를 계속한다', async () => {
  mocks.read.mockRejectedValueOnce(new Error('unreadable'))
  await act(async () => {
    await evaluation.evaluate(samples)
  })
  expect(evaluation.results.one).toEqual({ status: 'failed' })
  expect(evaluation.results.two).toMatchObject({ status: 'success' })
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

it('전처리 변경 시 이전 점수와 진행 상태를 비운다', async () => {
  await act(async () => {
    await evaluation.evaluate(samples)
  })
  await act(async () => evaluation.setPreprocessing('raw'))
  expect(evaluation.results).toEqual({})
  expect(evaluation.progress).toEqual({ done: 0, total: 0 })
})
