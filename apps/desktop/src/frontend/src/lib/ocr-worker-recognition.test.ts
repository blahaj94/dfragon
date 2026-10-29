import { beforeEach, expect, it, vi } from 'vitest'
import type { PartyOcrResult, PartyOcrWorker } from '../types/capture'
import { createSharedOcrWorker } from './ocr-worker-recognition'

const mocks = vi.hoisted(() => ({ createPartyOcrWorker: vi.fn() }))
vi.mock('./ocr', () => mocks)

const PREPARE_FAILED = '글자 인식을 준비하지 못했습니다'
const result: PartyOcrResult = { candidates: [] }
const image = {} as HTMLCanvasElement

function fakeWorker() {
  return {
    recognize: vi.fn<PartyOcrWorker['recognize']>().mockResolvedValue(result),
    terminate: vi.fn()
  }
}

function recognizeOnce(recognizeText: PartyOcrWorker['recognize']): Promise<string> {
  return recognizeText(image).then(
    () => 'recognized',
    () => 'failed'
  )
}

let worker: ReturnType<typeof fakeWorker>

beforeEach(() => {
  vi.resetAllMocks()
  worker = fakeWorker()
  mocks.createPartyOcrWorker.mockResolvedValue(worker)
})

it('회차가 끝나도 worker를 정리하지 않고 다음 회차가 다시 쓴다', async () => {
  const ocr = createSharedOcrWorker()

  await expect(ocr.recognize(new AbortController().signal, '실패', recognizeOnce)).resolves.toBe(
    'recognized'
  )
  await expect(ocr.recognize(new AbortController().signal, '실패', recognizeOnce)).resolves.toBe(
    'recognized'
  )

  expect(mocks.createPartyOcrWorker).toHaveBeenCalledOnce()
  expect(worker.recognize).toHaveBeenCalledTimes(2)
  expect(worker.terminate).not.toHaveBeenCalled()
})

it('미리 띄운 worker를 첫 회차가 쓴다', async () => {
  const ocr = createSharedOcrWorker()
  ocr.prepare()
  expect(mocks.createPartyOcrWorker).toHaveBeenCalledOnce()

  await ocr.recognize(new AbortController().signal, '실패', recognizeOnce)

  expect(mocks.createPartyOcrWorker).toHaveBeenCalledOnce()
  expect(worker.recognize).toHaveBeenCalledOnce()
})

it('회차의 인식이 실패하면 실패 문구로 던지고 worker는 유지한다', async () => {
  const ocr = createSharedOcrWorker()

  await expect(
    ocr.recognize(new AbortController().signal, '실패', () => Promise.reject(new Error('x')))
  ).rejects.toThrow('실패')

  expect(worker.terminate).not.toHaveBeenCalled()
})

it('worker의 인식 요청이 실패하면 그 worker를 정리하고 다음 회차가 새로 띄운다', async () => {
  const next = fakeWorker()
  worker.recognize.mockRejectedValueOnce(new Error('PaddleOCR timed out.'))
  mocks.createPartyOcrWorker.mockResolvedValueOnce(worker).mockResolvedValueOnce(next)
  const ocr = createSharedOcrWorker()

  await expect(ocr.recognize(new AbortController().signal, '실패', recognizeOnce)).resolves.toBe(
    'failed'
  )
  expect(worker.terminate).toHaveBeenCalledOnce()

  await expect(ocr.recognize(new AbortController().signal, '실패', recognizeOnce)).resolves.toBe(
    'recognized'
  )
  expect(next.recognize).toHaveBeenCalledOnce()
  expect(next.terminate).not.toHaveBeenCalled()
})

it('worker를 띄우지 못하면 준비 실패 문구로 던지고 다음 회차가 다시 띄운다', async () => {
  mocks.createPartyOcrWorker.mockRejectedValueOnce(new Error('x'))
  const ocr = createSharedOcrWorker()
  const run = vi.fn(recognizeOnce)

  await expect(ocr.recognize(new AbortController().signal, '실패', run)).rejects.toThrow(
    PREPARE_FAILED
  )
  expect(run).not.toHaveBeenCalled()

  await expect(ocr.recognize(new AbortController().signal, '실패', run)).resolves.toBe('recognized')
  expect(mocks.createPartyOcrWorker).toHaveBeenCalledTimes(2)
})

it('worker 준비를 기다리는 동안 회차가 취소되면 준비 실패로 던지고 worker는 다음 회차에 남긴다', async () => {
  const pending = Promise.withResolvers<typeof worker>()
  mocks.createPartyOcrWorker.mockReturnValueOnce(pending.promise)
  const ocr = createSharedOcrWorker()
  const controller = new AbortController()
  const run = vi.fn(recognizeOnce)

  const cancelled = ocr.recognize(controller.signal, '실패', run)
  controller.abort()
  pending.resolve(worker)

  await expect(cancelled).rejects.toThrow(PREPARE_FAILED)
  expect(run).not.toHaveBeenCalled()
  expect(worker.terminate).not.toHaveBeenCalled()
  await ocr.recognize(new AbortController().signal, '실패', recognizeOnce)
  expect(mocks.createPartyOcrWorker).toHaveBeenCalledOnce()
  expect(worker.recognize).toHaveBeenCalledOnce()
})

it('worker에는 한 번에 한 요청만 보내고 취소된 회차의 남은 요청은 보내지 않는다', async () => {
  const first = Promise.withResolvers<PartyOcrResult>()
  worker.recognize.mockReturnValueOnce(first.promise)
  const ocr = createSharedOcrWorker()
  const previous = new AbortController()
  const previousRound = ocr.recognize(previous.signal, '실패', async (recognizeText) => {
    const slots = [recognizeOnce(recognizeText), recognizeOnce(recognizeText)]

    return Promise.all(slots)
  })
  await vi.waitFor(() => expect(worker.recognize).toHaveBeenCalledOnce())

  const nextRound = ocr.recognize(new AbortController().signal, '실패', recognizeOnce)
  previous.abort()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(worker.recognize).toHaveBeenCalledOnce()
  first.resolve(result)

  await expect(previousRound).rejects.toThrow('실패')
  await expect(nextRound).resolves.toBe('recognized')
  expect(worker.recognize).toHaveBeenCalledTimes(2)
  expect(worker.terminate).not.toHaveBeenCalled()
})

it('release는 준비 중인 worker를 취소하고 띄운 worker를 정리하며 다음 회차는 새로 띄운다', async () => {
  const pending = Promise.withResolvers<typeof worker>()
  const next = fakeWorker()
  mocks.createPartyOcrWorker.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(next)
  const ocr = createSharedOcrWorker()
  ocr.prepare()
  const signal = mocks.createPartyOcrWorker.mock.calls[0][0] as AbortSignal

  ocr.release()
  expect(signal.aborted).toBe(true)
  pending.resolve(worker)
  await vi.waitFor(() => expect(worker.terminate).toHaveBeenCalledOnce())

  await ocr.recognize(new AbortController().signal, '실패', recognizeOnce)
  expect(mocks.createPartyOcrWorker).toHaveBeenCalledTimes(2)
  expect(next.recognize).toHaveBeenCalledOnce()
  expect(worker.recognize).not.toHaveBeenCalled()
})
