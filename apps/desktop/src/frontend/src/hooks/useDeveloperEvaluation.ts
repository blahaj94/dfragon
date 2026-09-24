import { useEffect, useRef, useState } from 'react'
import type { DeveloperSample } from '../../../preload/common/types/developer'
import { createPartyOcrWorker } from '../lib/ocr'
import { readDeveloperImage } from '../lib/developer-images'
import { invertNicknamePixels } from '../lib/nickname-pixels'
import type { DeveloperEvaluation, EvaluationPreprocessing } from '../lib/developer-evaluation'

export function useDeveloperEvaluation(): {
  results: Record<string, DeveloperEvaluation>
  running: boolean
  canceled: boolean
  preprocessing: EvaluationPreprocessing
  progress: { done: number; total: number }
  error: string
  setPreprocessing: (value: EvaluationPreprocessing) => void
  evaluate: (samples: readonly DeveloperSample[]) => Promise<void>
  cancel: () => void
} {
  const active = useRef<AbortController | null>(null)
  const [running, setRunning] = useState(false)
  const [canceled, setCanceled] = useState(false)
  const [results, setResults] = useState<Record<string, DeveloperEvaluation>>({})
  const [preprocessing, setPreprocessingState] = useState<EvaluationPreprocessing>('party')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  useEffect(() => () => active.current?.abort(), [])

  function cancel(): void {
    setCanceled(active.current != null)
    active.current?.abort()
    active.current = null
    setRunning(false)
  }

  function setPreprocessing(value: EvaluationPreprocessing): void {
    cancel()
    setCanceled(false)
    setResults({})
    setProgress({ done: 0, total: 0 })
    setError('')
    setPreprocessingState(value)
  }

  async function evaluate(samples: readonly DeveloperSample[]): Promise<void> {
    if (active.current != null || samples.length === 0) {
      return
    }
    const controller = new AbortController()
    active.current = controller
    const { signal } = controller
    setRunning(true)
    setCanceled(false)
    setError('')
    setProgress({ done: 0, total: samples.length })
    // 이번 실행 대상은 이전 점수와 섞지 않고 결과가 도착할 때 다시 채운다.
    setResults((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([id]) => !samples.some((sample) => sample.id === id))
      )
    )
    let worker: Awaited<ReturnType<typeof createPartyOcrWorker>> | null = null
    try {
      worker = await createPartyOcrWorker(signal)
      for (const [index, sample] of samples.entries()) {
        signal.throwIfAborted()
        let result: DeveloperEvaluation
        try {
          const dataUrl = await window.developer.readImage(sample.id)
          signal.throwIfAborted()
          const canvas = await readDeveloperImage(dataUrl)
          signal.throwIfAborted()
          // 단일 텍스트 행 인식 모델의 비정상적으로 큰 텐서 생성을 제한한다.
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
        setResults((previous) => ({ ...previous, [sample.id]: result }))
        setProgress({ done: index + 1, total: samples.length })
      }
    } catch {
      if (!signal.aborted) {
        setError('모델을 준비하지 못했습니다. 다시 평가해 주세요.')
      }
    } finally {
      await worker?.terminate()
      if (active.current === controller) {
        active.current = null
        setRunning(false)
      }
    }
  }
  return {
    results,
    running,
    canceled,
    preprocessing,
    progress,
    error,
    setPreprocessing,
    evaluate,
    cancel
  }
}
