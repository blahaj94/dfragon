import type { DeveloperSample } from '../../../preload/common/types/developer'
import { createPartyOcrWorker } from './ocr'
import { readDeveloperImage } from './developer-images'
import { invertNicknamePixels } from './nickname-pixels'
import type { DeveloperEvaluation, EvaluationPreprocessing } from './developer-evaluation'

export type DeveloperEvaluationRun = {
  samples: readonly DeveloperSample[]
  preprocessing: EvaluationPreprocessing
  report: (id: string, result: DeveloperEvaluation) => void
}

/** 한 실행에서 worker를 공유해 순차 평가하고, actor의 취소 신호와 같은 수명으로 정리한다. */
export async function runDeveloperEvaluation(
  { samples, preprocessing, report }: DeveloperEvaluationRun,
  signal: AbortSignal
): Promise<void> {
  let worker: Awaited<ReturnType<typeof createPartyOcrWorker>> | null = null
  try {
    worker = await createPartyOcrWorker(signal)
    for (const sample of samples) {
      signal.throwIfAborted()
      let result: DeveloperEvaluation
      try {
        const dataUrl = await window.developer.readImage(sample.id)
        signal.throwIfAborted()
        const canvas = await readDeveloperImage(dataUrl)
        signal.throwIfAborted()
        // 한 줄 인식 모델에 비정상적으로 큰 텐서가 입력되지 않게 제한한다.
        if ((48 * canvas.width) / canvas.height > 4096) {
          throw new Error('Image aspect ratio too wide.')
        }
        const context = canvas.getContext('2d')!
        if (preprocessing === 'party') {
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
          invertNicknamePixels(pixels.data)
          context.putImageData(pixels, 0, 0)
        }
        const started = performance.now()
        const recognition = await worker.recognize(canvas)
        result = {
          status: 'success',
          ...recognition.data,
          milliseconds: performance.now() - started
        }
      } catch {
        signal.throwIfAborted()
        result = { status: 'failed' }
      }
      signal.throwIfAborted()
      report(sample.id, result)
    }
  } finally {
    await worker?.terminate()
  }
}
