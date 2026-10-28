import { beforeEach, expect, it, vi } from 'vitest'
import { recognizeWithOcrWorker } from './ocr-worker-recognition'

const mocks = vi.hoisted(() => ({ createPartyOcrWorker: vi.fn() }))
vi.mock('./ocr', () => mocks)

const terminate = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  terminate.mockResolvedValue(undefined)
  mocks.createPartyOcrWorker.mockResolvedValue({ recognize: vi.fn(), terminate })
})

it('인식 결과를 돌려주고 worker를 정리한다', async () => {
  await expect(
    recognizeWithOcrWorker(new AbortController().signal, '실패', async () => 'ok')
  ).resolves.toBe('ok')
  expect(terminate).toHaveBeenCalledOnce()
})

it('인식이 실패하면 실패 문구로 던지고 worker를 정리한다', async () => {
  await expect(
    recognizeWithOcrWorker(new AbortController().signal, '실패', () =>
      Promise.reject(new Error('x'))
    )
  ).rejects.toThrow('실패')
  expect(terminate).toHaveBeenCalledOnce()
})

it('worker를 만들지 못하면 준비 실패 문구로 던진다', async () => {
  mocks.createPartyOcrWorker.mockRejectedValue(new Error('x'))
  await expect(
    recognizeWithOcrWorker(new AbortController().signal, '실패', async () => 'ok')
  ).rejects.toThrow('글자 인식을 준비하지 못했습니다')
})

it('worker를 만든 뒤 취소되면 정리하고 준비 실패 문구로 던진다', async () => {
  const controller = new AbortController()
  mocks.createPartyOcrWorker.mockImplementation(async () => {
    controller.abort()

    return { recognize: vi.fn(), terminate }
  })
  const recognize = vi.fn()

  await expect(recognizeWithOcrWorker(controller.signal, '실패', recognize)).rejects.toThrow(
    '글자 인식을 준비하지 못했습니다'
  )
  expect(recognize).not.toHaveBeenCalled()
  expect(terminate).toHaveBeenCalledOnce()
})
