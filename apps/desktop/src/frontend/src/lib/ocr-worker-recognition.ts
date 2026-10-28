import type { PartyOcrWorker } from '../types/capture'
import { createPartyOcrWorker } from './ocr'

const PREPARE_FAILED_STATUS = '글자 인식을 준비하지 못했습니다. Alt+R을 눌러 다시 인식해 주세요.'

async function openWorker(signal: AbortSignal): Promise<PartyOcrWorker> {
  const worker = await createPartyOcrWorker(signal).catch(() => {
    throw new Error(PREPARE_FAILED_STATUS)
  })
  if (signal.aborted) {
    await worker.terminate().catch(() => undefined)
    throw new Error(PREPARE_FAILED_STATUS)
  }

  return worker
}

export async function recognizeWithOcrWorker<T>(
  signal: AbortSignal,
  failedStatus: string,
  recognize: (recognizeText: PartyOcrWorker['recognize']) => Promise<T>
): Promise<T> {
  const worker = await openWorker(signal)
  try {
    try {
      const results = await recognize(worker.recognize)
      signal.throwIfAborted()

      return results
    } finally {
      await worker.terminate()
    }
  } catch {
    throw new Error(failedStatus)
  }
}
