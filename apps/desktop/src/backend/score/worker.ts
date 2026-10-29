import { parentPort, workerData } from 'node:worker_threads'
import type { ScoreWorkerData, ScoreWorkerMessage, ScoreWorkerRequest } from './worker-protocol'
import { openNativeScore } from './native'
import { SCORE_WARMUP_INPUT } from './warmup-input'

function startScoreWorker(): void {
  const port = parentPort
  if (port === null) {
    throw new Error('SCORE_WORKER_REQUIRED')
  }
  const post = (message: ScoreWorkerMessage): void => port.postMessage(message)
  const { path } = workerData as ScoreWorkerData
  const score = openNativeScore({ path })
  if (score === null) {
    post({ kind: 'unavailable' })

    return
  }
  // 첫 계산 초기화는 thread마다 따로 들므로, 이후 요청을 계산할 이 thread에서 두 계산기를 먼저 한 번씩 부른다.
  // 그동안 도착한 요청은 port에 쌓였다가 아래 listener를 붙인 뒤 차례로 계산한다.
  score(SCORE_WARMUP_INPUT, 'equipment')
  score(SCORE_WARMUP_INPUT, 'buff')
  port.on('message', (request: ScoreWorkerRequest) => {
    const startedAt = performance.now()
    const text = score(request.input, request.calculator)
    post({ kind: 'result', id: request.id, text, elapsedMs: performance.now() - startedAt })
  })
}

startScoreWorker()
