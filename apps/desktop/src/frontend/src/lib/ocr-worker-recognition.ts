import type { PartyOcrResult, PartyOcrWorker } from '../types/capture'
import { createPartyOcrWorker } from './ocr'

const PREPARE_FAILED_STATUS = '글자 인식을 준비하지 못했습니다. Alt+R을 눌러 다시 인식해 주세요.'

export type OcrRecognition = <T>(
  signal: AbortSignal,
  failedStatus: string,
  recognize: (recognizeText: PartyOcrWorker['recognize']) => Promise<T>
) => Promise<T>

export type SharedOcrWorker = {
  prepare: () => void
  recognize: OcrRecognition
  release: () => void
}

type WorkerEntry = {
  controller: AbortController
  worker: Promise<PartyOcrWorker>
}

/**
 * 모델 로드를 회차마다 반복하지 않도록 worker 하나를 회차 사이에 유지하고 파티와 공대 회차가 함께 쓴다.
 * Worker는 한 번에 이미지 하나만 받으므로 인식 요청을 차례로 보내고, 취소된 회차의 남은 요청은 보내지 않는다.
 */
export function createSharedOcrWorker(): SharedOcrWorker {
  let current: WorkerEntry | null = null
  let queue: Promise<unknown> = Promise.resolve()

  function acquire(): WorkerEntry {
    if (current === null) {
      const controller = new AbortController()
      const entry = { controller, worker: createPartyOcrWorker(controller.signal) }
      current = entry
      entry.worker.catch(() => discard(entry))
    }

    return current
  }

  function discard(entry: WorkerEntry): void {
    if (current !== entry) {
      return
    }
    current = null
    entry.controller.abort()
    entry.worker.then(
      (worker) => worker.terminate(),
      () => undefined
    )
  }

  async function recognize<T>(
    signal: AbortSignal,
    failedStatus: string,
    run: (recognizeText: PartyOcrWorker['recognize']) => Promise<T>
  ): Promise<T> {
    const entry = acquire()
    const worker = await entry.worker.catch(() => {
      throw new Error(PREPARE_FAILED_STATUS)
    })
    if (signal.aborted) {
      throw new Error(PREPARE_FAILED_STATUS)
    }

    function recognizeText(image: HTMLCanvasElement): Promise<PartyOcrResult> {
      const result = queue.then(() => {
        signal.throwIfAborted()

        // 시간 초과나 오류로 끝난 worker는 다음 회차가 새로 띄운다.

        return worker.recognize(image).catch((error: unknown) => {
          discard(entry)
          throw error
        })
      })
      queue = result.catch(() => undefined)

      return result
    }

    try {
      const results = await run(recognizeText)
      signal.throwIfAborted()

      return results
    } catch {
      throw new Error(failedStatus)
    }
  }

  return {
    prepare() {
      acquire()
    },
    recognize,
    release() {
      if (current !== null) {
        discard(current)
      }
    }
  }
}
