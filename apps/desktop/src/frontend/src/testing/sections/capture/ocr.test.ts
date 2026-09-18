import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPartyOcrWorker } from '../../../sections/capture/ocr'

class NativeWorker {
  static latest: NativeWorker
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() {
    NativeWorker.latest = this
  }
  reply(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent)
  }
}
const image = {
  width: 91,
  height: 14,
  getContext: () => ({ getImageData: () => ({ synthetic: true }) })
} as unknown as HTMLCanvasElement
beforeEach(() => {
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
  it('응답하지 않는 초기화와 인식은 종료하며 raw 실패를 노출하지 않는다', async () => {
    vi.useFakeTimers()
    const creating = createPartyOcrWorker()
    const rejected = expect(creating).rejects.toThrow('PaddleOCR timed out.')
    await vi.advanceTimersByTimeAsync(30_000)
    await rejected
    expect(NativeWorker.latest.terminate).toHaveBeenCalledOnce()
    const retry = createPartyOcrWorker()
    NativeWorker.latest.reply({ ready: true })
    const worker = await retry
    const recognizing = worker.recognize(image)
    const failure = expect(recognizing).rejects.toThrow('PaddleOCR could not complete recognition.')
    NativeWorker.latest.reply({ failed: true, internal: 'synthetic internal error' })
    await failure
  })
})
