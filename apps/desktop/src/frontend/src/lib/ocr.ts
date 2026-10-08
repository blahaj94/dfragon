import type { PartyOcrResult, PartyOcrWorker } from '../types/capture'
import { REQUEST_TIMEOUT_MS } from '../constants/capture'

type Reply = { ready: true } | PartyOcrResult

const MAX_OCR_CANDIDATES = 2
const MAX_MODEL_SCORE = 100

/** 초기화 성공을 인식 결과나 실패와 섞인 메시지로 받아들이지 않는다. */
function isReadyReply(value: unknown): value is { ready: true } {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'ready' in value &&
    value.ready === true &&
    !('failed' in value) &&
    !('text' in value) &&
    !('confidence' in value) &&
    !('candidates' in value)
  )
}

/** worker 경계에서 후보의 순서와 1위 호환 필드를 검증하며 원문은 그대로 유지한다. */
function isRecognitionReply(value: unknown): value is PartyOcrResult {
  if (
    value == null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    'ready' in value ||
    'failed' in value ||
    !('text' in value) ||
    typeof value.text !== 'string' ||
    !('confidence' in value) ||
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence) ||
    !('candidates' in value) ||
    !Array.isArray(value.candidates) ||
    value.candidates.length > MAX_OCR_CANDIDATES
  ) {
    return false
  }
  let previousScore = MAX_MODEL_SCORE
  let firstNickname = ''
  let firstScore = 0
  for (let index = 0; index < value.candidates.length; index += 1) {
    const candidate: unknown = value.candidates[index]
    if (
      candidate == null ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate) ||
      !('rank' in candidate) ||
      candidate.rank !== index + 1 ||
      !('nickname' in candidate) ||
      typeof candidate.nickname !== 'string' ||
      !('modelScore' in candidate) ||
      typeof candidate.modelScore !== 'number' ||
      !Number.isFinite(candidate.modelScore) ||
      candidate.modelScore < 0 ||
      candidate.modelScore > previousScore
    ) {
      return false
    }

    if (index === 0) {
      firstNickname = candidate.nickname
      firstScore = candidate.modelScore
    }
    previousScore = candidate.modelScore
  }

  return value.text === firstNickname && value.confidence === firstScore
}

export class OcrWorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OcrWorkerUnavailableError'
  }
}

/** OCR worker를 초기화하고 인식 요청·시간 초과·취소에 따른 정리를 관리한다. */
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
  worker.onmessage = (event: MessageEvent<unknown>): void => {
    if (stopped || pending == null) {
      return
    }
    const value = event.data
    if (!isReadyReply(value) && !isRecognitionReply(value)) {
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
