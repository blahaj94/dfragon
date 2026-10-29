import type { PartyOcrResult, PartyOcrWorker } from '../types/capture'
import { REQUEST_TIMEOUT_MS } from '../constants/capture'

type Reply = { ready: true } | PartyOcrResult
type WorkerMessage = Reply | { failed: true }

class OcrWorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OcrWorkerUnavailableError'
  }
}

export async function createPartyOcrWorker(
  signal?: AbortSignal,
  preprocessing: 'party' | 'raw' = 'party'
): Promise<PartyOcrWorker> {
  signal?.throwIfAborted()
  const worker = new Worker(new URL('./paddle.worker.ts', import.meta.url), { type: 'module' })
  let stopped = false
  let stopReason: Error = new DOMException('OCR stopped.', 'AbortError')
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
    stopReason = error
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
    terminate(new OcrWorkerUnavailableError('PaddleOCR could not complete recognition.'))
  }
  worker.onmessageerror = (): void =>
    terminate(new OcrWorkerUnavailableError('PaddleOCR response could not be read.'))
  worker.onmessage = (event: MessageEvent<WorkerMessage>): void => {
    if (stopped || pending == null) {
      return
    }
    const value = event.data
    if ('failed' in value) {
      terminate(new OcrWorkerUnavailableError('PaddleOCR could not complete recognition.'))

      return
    }
    const current = pending
    pending = null
    clearTimeout(current.timer)
    current.resolve(value)
  }
  function request(
    input: { root: string } | { pixels: ImageData; preprocessing: 'party' | 'raw' }
  ): Promise<Reply> {
    if (stopped) {
      return Promise.reject(stopReason)
    }

    if (pending != null) {
      return Promise.reject(new Error('PaddleOCR is already recognizing an image.'))
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => terminate(new OcrWorkerUnavailableError('PaddleOCR timed out.')),
        REQUEST_TIMEOUT_MS
      )
      pending = { resolve, reject, timer }
      try {
        worker.postMessage(input)
      } catch {
        terminate(new OcrWorkerUnavailableError('PaddleOCR request could not be sent.'))
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
        const result = await request({ pixels, preprocessing })
        if ('ready' in result) {
          const error = new OcrWorkerUnavailableError(
            'PaddleOCR returned an invalid recognition result.'
          )
          terminate(error)
          throw error
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
