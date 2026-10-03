import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPartyOcrWorker, OcrWorkerUnavailableError } from './ocr'

class NativeWorker {
  static latest: NativeWorker
  static instances: NativeWorker[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() {
    NativeWorker.latest = this
    NativeWorker.instances.push(this)
  }
  reply(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent)
  }
}
const pixels: ImageData = {
  width: 91,
  height: 14,
  data: new Uint8ClampedArray(91 * 14 * 4),
  colorSpace: 'srgb'
}
// Node에서는 canvas 디코딩 대신 getImageData 경계만 제공하며 worker 메시지 형태는 유지한다.
const image = {
  width: 91,
  height: 14,
  getContext: () => ({ getImageData: () => pixels })
} as unknown as HTMLCanvasElement
beforeEach(() => {
  NativeWorker.instances = []
  vi.stubGlobal('Worker', NativeWorker)
  vi.stubGlobal('document', { baseURI: 'file:///app/out/frontend/index.html' })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('PaddleOCR worker 수명', () => {
  it('앱의 로컬 모델로 초기화하고 실제 worker 결과를 기존 검색 소비 형태로 반환한다', async () => {
    const creating = createPartyOcrWorker()
    const native = NativeWorker.latest
    expect(native.postMessage).toHaveBeenCalledWith({ root: 'file:///app/out/frontend/ocr/' })
    native.reply({ ready: true })
    const worker = await creating
    const recognizing = worker.recognize(image)
    native.reply({ text: '합성문자', confidence: 82 })
    expect(await recognizing).toEqual({ data: { text: '합성문자', confidence: 82 } })
    await worker.terminate()
    await worker.terminate()
    expect(native.terminate).toHaveBeenCalledOnce()
  })
  it('초기화 중 Stop도 worker를 종료하고 대기를 해제한다', async () => {
    const controller = new AbortController()
    const creating = createPartyOcrWorker(controller.signal)
    const rejected = expect(creating).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    NativeWorker.latest.reply({ ready: true })
    await rejected
    expect(NativeWorker.latest.terminate).toHaveBeenCalledOnce()
  })
  it('인식 중 Stop이 늦은 결과를 막고 새 요청도 거절한다', async () => {
    const controller = new AbortController()
    const creating = createPartyOcrWorker(controller.signal)
    NativeWorker.latest.reply({ ready: true })
    const worker = await creating
    const recognizing = worker.recognize(image)
    const rejected = expect(recognizing).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    NativeWorker.latest.reply({ text: '늦은합성', confidence: 99 })
    await rejected
    await expect(worker.recognize(image)).rejects.toMatchObject({ name: 'AbortError' })
    expect(NativeWorker.latest.terminate).toHaveBeenCalledOnce()
  })
  it('이미 취소된 신호는 native worker를 만들지 않는다', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(createPartyOcrWorker(controller.signal)).rejects.toMatchObject({
      name: 'AbortError'
    })

    expect(NativeWorker.instances).toHaveLength(0)
  })

  it.each(['초기화', '인식'] as const)(
    '%s 응답이 30초 동안 없으면 대기를 거절하고 종료한다',
    async (stage) => {
      vi.useFakeTimers()
      const creating = createPartyOcrWorker()
      const native = NativeWorker.latest
      let pending: Promise<unknown> = creating
      let worker: Awaited<ReturnType<typeof createPartyOcrWorker>> | undefined
      if (stage === '인식') {
        native.reply({ ready: true })
        worker = await creating
        pending = worker.recognize(image)
      }
      const rejected = expect(pending).rejects.toThrow('PaddleOCR timed out.')

      await vi.advanceTimersByTimeAsync(29_999)
      expect(native.terminate).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await rejected

      expect(native.terminate).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
      if (worker != null) {
        await expect(worker.recognize(image)).rejects.toBeInstanceOf(OcrWorkerUnavailableError)
        expect(native.postMessage).toHaveBeenCalledTimes(2)
      }
    }
  )

  it.each(['메시지 전송 실패', 'worker 실행 오류', '메시지 읽기 실패'] as const)(
    '%s는 진행 중인 인식을 거절하고 새 worker로 다시 시작할 수 있다',
    async (failure) => {
      vi.useFakeTimers()
      const creating = createPartyOcrWorker()
      const native = NativeWorker.latest
      native.reply({ ready: true })
      const worker = await creating
      if (failure === '메시지 전송 실패') {
        native.postMessage.mockImplementationOnce(() => {
          throw new Error('synthetic native details')
        })
      }
      const recognizing = worker.recognize(image)
      const messages = {
        '메시지 전송 실패': 'PaddleOCR request could not be sent.',
        'worker 실행 오류': 'PaddleOCR could not complete recognition.',
        '메시지 읽기 실패': 'PaddleOCR response could not be read.'
      }
      const rejected = expect(recognizing).rejects.toMatchObject({
        name: 'OcrWorkerUnavailableError',
        message: messages[failure]
      })
      if (failure === 'worker 실행 오류') {
        const event = new Event('error', { cancelable: true })
        native.onerror?.(event as ErrorEvent)
        expect(event.defaultPrevented).toBe(true)
      } else if (failure === '메시지 읽기 실패') {
        native.onmessageerror?.()
      }
      await rejected
      await expect(worker.recognize(image)).rejects.toBeInstanceOf(OcrWorkerUnavailableError)
      expect(native.terminate).toHaveBeenCalledOnce()
      expect(native.postMessage).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(0)
      native.reply({ text: '이전인식', confidence: 99 })

      const retry = createPartyOcrWorker()
      const nextNative = NativeWorker.latest
      nextNative.reply({ ready: true })
      const nextWorker = await retry
      const nextRecognition = nextWorker.recognize(image)
      nextNative.reply({ text: '재시도', confidence: 82 })
      expect(await nextRecognition).toEqual({ data: { text: '재시도', confidence: 82 } })
      expect(nextNative.terminate).not.toHaveBeenCalled()
      await nextWorker.terminate()
      expect(nextNative.terminate).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    }
  )

  it.each([
    {
      name: '내부 오류 응답',
      value: { failed: true, internal: 'synthetic internal error' },
      message: 'PaddleOCR could not complete recognition.'
    },
    {
      name: '유한하지 않은 신뢰도',
      value: { text: '합성문자', confidence: Infinity },
      message: 'PaddleOCR could not complete recognition.'
    },
    {
      name: '인식 요청에 초기화 응답',
      value: { ready: true },
      message: 'PaddleOCR returned an invalid recognition result.'
    }
  ])('$name은 닉네임으로 반환하지 않고 worker를 종료한다', async ({ value, message }) => {
    const creating = createPartyOcrWorker()
    const native = NativeWorker.latest
    native.reply({ ready: true })
    const worker = await creating
    const recognizing = worker.recognize(image)
    const rejected = expect(recognizing).rejects.toMatchObject({
      name: 'OcrWorkerUnavailableError',
      message
    })

    native.reply(value)
    await rejected
    await expect(worker.recognize(image)).rejects.toBeInstanceOf(OcrWorkerUnavailableError)
    expect(native.terminate).toHaveBeenCalledOnce()
    expect(native.postMessage).toHaveBeenCalledTimes(2)
  })

  it('동시 인식은 거절하되 먼저 시작한 인식과 후속 인식은 유지한다', async () => {
    vi.useFakeTimers()
    const creating = createPartyOcrWorker()
    const native = NativeWorker.latest
    native.reply({ ready: true })
    const worker = await creating
    expect(vi.getTimerCount()).toBe(0)
    const recognizing = worker.recognize(image)

    await expect(worker.recognize(image)).rejects.toThrow(
      'PaddleOCR is already recognizing an image.'
    )
    expect(native.postMessage).toHaveBeenCalledTimes(2)
    expect(native.terminate).not.toHaveBeenCalled()
    native.reply({ text: '첫인식', confidence: 80 })
    expect(await recognizing).toEqual({ data: { text: '첫인식', confidence: 80 } })
    expect(vi.getTimerCount()).toBe(0)

    const next = worker.recognize(image)
    native.reply({ text: '', confidence: 0 })
    expect(await next).toEqual({ data: { text: '', confidence: 0 } })
    expect(native.postMessage).toHaveBeenLastCalledWith({ pixels })
    expect(vi.getTimerCount()).toBe(0)
    await worker.terminate()
    expect(native.terminate).toHaveBeenCalledOnce()
  })
})
