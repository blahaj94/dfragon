import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import type { CharacterScoreCalculator } from '../../preload/common/types/character'
import { readEngineInput } from './details-test-fixture'
import type { ScoreWorkerMessage, ScoreWorkerRequest } from './worker-protocol'
import type { ScoreEngineInput } from './input'
import type { NativeScore } from './native'
import { SCORE_WARMUP_INPUT } from './warmup-input'

// worker 진입 파일은 import하면 바로 시작하므로, thread 경계와 네이티브 호출만 바꿔 끼운다.
const mocks = vi.hoisted(() => ({
  port: null as (EventEmitter & { postMessage: (message: ScoreWorkerMessage) => void }) | null,
  score: null as NativeScore | null
}))

vi.mock('node:worker_threads', () => ({
  get parentPort() {
    return mocks.port
  },
  workerData: { path: '/synthetic/libdnfscore.dylib' }
}))
vi.mock('./native', () => ({ openNativeScore: () => mocks.score }))

afterEach(() => {
  vi.resetModules()
})

function startWorker(score: NativeScore | null) {
  const posted: ScoreWorkerMessage[] = []
  const port = Object.assign(new EventEmitter(), {
    postMessage: (message: ScoreWorkerMessage) => posted.push(message)
  })
  mocks.port = port
  mocks.score = score

  return { port, posted, start: () => import('./worker') }
}

it('요청을 계산하기 전에 두 계산기를 준비 입력으로 한 번씩 부른다', async () => {
  const calls: [ScoreEngineInput, CharacterScoreCalculator][] = []
  const { port, posted, start } = startWorker((input, calculator) => {
    calls.push([input, calculator])

    return '{"score":1}'
  })
  await start()
  const input = readEngineInput('dealer-blade')
  port.emit('message', { id: 7, input, calculator: 'equipment' } satisfies ScoreWorkerRequest)

  expect(calls).toEqual([
    [SCORE_WARMUP_INPUT, 'equipment'],
    [SCORE_WARMUP_INPUT, 'buff'],
    [input, 'equipment']
  ])
  expect(posted).toEqual([
    { kind: 'result', id: 7, text: '{"score":1}', elapsedMs: expect.any(Number) }
  ])
})

it('라이브러리를 열지 못하면 준비 없이 unavailable만 알린다', async () => {
  const { posted, start } = startWorker(null)
  await start()

  expect(posted).toEqual([{ kind: 'unavailable' }])
})
