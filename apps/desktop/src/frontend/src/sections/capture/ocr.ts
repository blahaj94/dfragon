import type { PartyOcrWorker } from '../../types/capture'
import { REQUEST_TIMEOUT_MS } from '../../constants/capture'

type Reply = { ready: true } | { text: string; confidence: number }

export async function createPartyOcrWorker(signal?: AbortSignal): Promise<PartyOcrWorker> {
  signal?.throwIfAborted()
  const worker = new Worker(new URL('./paddle.worker.ts', import.meta.url), { type: 'module' })
  let stopped = false
  let pending: {
    resolve: (value: Reply) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null

  function terminate(error: Error = new DOMException('OCR stopped.', 'AbortError')): void {
    if (stopped) {
      return
    }
    stopped = true
    signal?.removeEventListener('abort', abort)
    worker.terminate()
    const current = pending
    pending = null
    if (current != null) {
      clearTimeout(current.timer)
      current.reject(error)
    }
  }
  function abort(): void {
    terminate()
  }
  signal?.addEventListener('abort', abort, { once: true })
  worker.onerror = (event): void => {
    event.preventDefault()
    terminate(new Error('PaddleOCR could not complete recognition.'))
  }
  worker.onmessageerror = (): void => terminate(new Error('PaddleOCR response could not be read.'))
  worker.onmessage = (event: MessageEvent<unknown>): void => {
    if (stopped || pending == null) {
      return
    }
    const value = event.data
    const object = value != null && typeof value === 'object'
    const ready = object && 'ready' in value && value.ready === true
    const recognized =
      object &&
      'text' in value &&
      typeof value.text === 'string' &&
      'confidence' in value &&
      typeof value.confidence === 'number' &&
      Number.isFinite(value.confidence)
    if (!ready && !recognized) {
      terminate(new Error('PaddleOCR could not complete recognition.'))
      return
    }
    const current = pending
    pending = null
    clearTimeout(current.timer)
    current.resolve(value as Reply)
  }
  function request(input: { root: string } | { pixels: ImageData }): Promise<Reply> {
    if (stopped) {
      return Promise.reject(new DOMException('OCR stopped.', 'AbortError'))
    }
    if (pending != null) {
      return Promise.reject(new Error('PaddleOCR is already recognizing an image.'))
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => terminate(new Error('PaddleOCR timed out.')),
        REQUEST_TIMEOUT_MS
      )
      pending = { resolve, reject, timer }
      try {
        worker.postMessage(input)
      } catch {
        terminate(new Error('PaddleOCR request could not be sent.'))
      }
    })
  }
  try {
    const initialized = await request({ root: new URL('ocr/', document.baseURI).toString() })
    if (!('ready' in initialized)) {
      throw new Error('PaddleOCR could not initialize.')
    }
    return {
      async recognize(image) {
        const context = image.getContext('2d')
        if (context == null) {
          throw new Error('Could not read the OCR image.')
        }
        const pixels = context.getImageData(0, 0, image.width, image.height)
        const result = await request({ pixels })
        if ('ready' in result) {
          throw new Error('PaddleOCR returned an invalid recognition result.')
        }
        return { data: result }
      },
      async terminate() {
        terminate()
      }
    }
  } catch (error) {
    terminate()
    throw error
  }
}
