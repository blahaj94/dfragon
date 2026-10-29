import { isAbsolute, join } from 'node:path'
import { z } from 'zod'
import type { CharacterScoreCalculator } from '../../preload/common/types/character'
import type { DiagnosticCode } from '../../preload/common/types/diagnostics'
import type { ScoreEngineInput } from './input'
import type { ScoreWorkerData, ScoreWorkerMessage, ScoreWorkerRequest } from './worker-protocol'

export const SCORE_LIBRARY_FILE_NAMES: Readonly<Partial<Record<NodeJS.Platform, string>>> = {
  win32: 'dnfscore.dll',
  darwin: 'libdnfscore.dylib',
  linux: 'libdnfscore.so'
}
const SLOW_SCORE_MS = 50

const nonblank = z.string().refine((value) => value.trim().length > 0)
const nullableNumber = z.number().nullable()
const resultSchema = z
  .object({
    calculator: z.enum(['equipment', 'buff']),
    score: z.int().nullable(),
    skipped: z.object({ kind: nonblank, message: nonblank }).nullable(),
    // rev14 이전 엔진은 근사값 칸을 보내지 않으므로 빠진 칸은 null로 받는다.
    approximate_score: z.int().nullable().default(null),
    approximate_source: nonblank.nullable().default(null),
    warning: nonblank.nullable().default(null),
    versions: z.object({ package: nonblank, rules_rev: nonblank, bundle_id: nonblank }),
    display: z.object({
      role: z.enum(['dealer', 'buffer']),
      switchingLevel: nullableNumber,
      buff30: nullableNumber,
      buff50: nullableNumber
    })
  })
  .refine((result) => (result.score === null) !== (result.skipped === null))
  .refine((result) => {
    if (result.approximate_score === null && result.approximate_source === null) {
      return result.warning === null || result.score !== null
    }

    return (
      result.approximate_score !== null &&
      result.approximate_source !== null &&
      result.warning !== null &&
      result.score === null
    )
  })

export type ScoreEngineResult = z.infer<typeof resultSchema>

export type ScoreEngine = Readonly<{
  /** 엔진이 없거나 계산하지 못하면 null이다. 신호가 취소되면 그 이유로 거절한다. */
  calculate: (
    input: ScoreEngineInput,
    calculator: CharacterScoreCalculator,
    signal: AbortSignal
  ) => Promise<ScoreEngineResult | null>
  prepare: () => void
}>

export type ScoreWorker = {
  postMessage: (request: ScoreWorkerRequest) => void
  on(event: 'message', listener: (message: ScoreWorkerMessage) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'exit', listener: (exitCode: number) => void): unknown
  terminate: () => unknown
}

export type ScoreEngineOptions = Readonly<{
  path: string | null
  spawn: (data: ScoreWorkerData) => ScoreWorker
  report: (code: DiagnosticCode) => void
}>

type ScoreReply = Readonly<{ text: string | null; elapsedMs: number }>
type RunningWorker = Readonly<{
  worker: ScoreWorker
  pending: Map<number, (reply: ScoreReply | null) => void>
}>
type WorkerState =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'running'; running: RunningWorker }>
  | Readonly<{ kind: 'stopped' }>
  | Readonly<{ kind: 'unavailable' }>

type ScoreLibraryLocation = Readonly<{
  isPackaged: boolean
  platform: NodeJS.Platform
  resourcesPath: string
  appPath: string
  env: Readonly<Record<string, string | undefined>>
}>

/**
 * 패키지는 asar 밖으로 푼 `resources/score/`만 쓴다. 환경변수로 다른 라이브러리를 싣지 못하게
 * `DFRAGON_SCORE_LIBRARY`는 개발 실행에서만 읽고, 절대 경로가 아니면 쓰지 않는다.
 */
export function resolveScoreLibraryPath(location: ScoreLibraryLocation): string | null {
  const fileName = SCORE_LIBRARY_FILE_NAMES[location.platform]
  if (fileName === undefined) {
    return null
  }

  if (location.isPackaged) {
    return join(location.resourcesPath, 'app.asar.unpacked', 'resources', 'score', fileName)
  }
  const configured = location.env['DFRAGON_SCORE_LIBRARY']
  if (configured === undefined || configured === '') {
    return join(location.appPath, 'resources', 'score', fileName)
  }

  if (!isAbsolute(configured)) {
    return null
  }

  return configured
}

function parseResult(text: string, calculator: CharacterScoreCalculator): ScoreEngineResult | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = resultSchema.safeParse(value)
  if (!parsed.success || parsed.data.calculator !== calculator) {
    return null
  }

  return parsed.data
}

/**
 * 네이티브 엔진은 첫 계산 초기화를 OS thread마다 따로 하므로, 준비와 모든 계산을 worker 하나에서 한다. 진단은
 * worker가 보낸 결과로 main에서 남긴다.
 */
export function createScoreEngine(
  options: ScoreEngineOptions
): ScoreEngine & Readonly<{ dispose: () => void }> {
  const { path, spawn, report } = options
  let state: WorkerState = { kind: 'idle' }
  let nextRequestId = 0

  function currentRunning(worker: ScoreWorker): RunningWorker | null {
    if (state.kind !== 'running' || state.running.worker !== worker) {
      return null
    }

    return state.running
  }

  function finish(worker: ScoreWorker, next: WorkerState, code: DiagnosticCode | null): void {
    const running = currentRunning(worker)
    if (running === null) {
      return
    }
    state = next
    if (code !== null) {
      report(code)
    }
    const settles = [...running.pending.values()]
    running.pending.clear()
    for (const settle of settles) {
      settle(null)
    }
    worker.terminate()
  }

  function receive(worker: ScoreWorker, message: ScoreWorkerMessage): void {
    if (message.kind === 'unavailable') {
      finish(worker, { kind: 'unavailable' }, 'SCORE_ENGINE_UNAVAILABLE')

      return
    }
    const settle = currentRunning(worker)?.pending.get(message.id)
    settle?.({ text: message.text, elapsedMs: message.elapsedMs })
  }

  function start(): void {
    if (path === null) {
      state = { kind: 'unavailable' }
      report('SCORE_ENGINE_UNAVAILABLE')

      return
    }
    let worker: ScoreWorker
    try {
      worker = spawn({ path })
    } catch {
      state = { kind: 'stopped' }
      report('SCORE_ENGINE_FAILED')

      return
    }
    state = { kind: 'running', running: { worker, pending: new Map() } }
    const stop = (): void => finish(worker, { kind: 'stopped' }, 'SCORE_ENGINE_FAILED')
    worker.on('message', (message) => receive(worker, message))
    worker.on('error', stop)
    worker.on('exit', stop)
  }

  function prepare(): void {
    if (state.kind === 'idle' || state.kind === 'stopped') {
      start()
    }
  }

  function request(
    running: RunningWorker,
    input: ScoreEngineInput,
    calculator: CharacterScoreCalculator,
    signal: AbortSignal
  ): Promise<ScoreReply | null> {
    const { promise, resolve, reject } = Promise.withResolvers<ScoreReply | null>()
    const id = nextRequestId
    nextRequestId += 1
    const cleanup = (): void => {
      signal.removeEventListener('abort', abort)
      running.pending.delete(id)
    }
    // 계산 중인 네이티브 호출은 멈출 수 없으므로, 취소된 요청은 응답을 기다리지 않고 늦은 응답은 버린다.
    const abort = (): void => {
      cleanup()
      reject(signal.reason)
    }
    running.pending.set(id, (reply) => {
      cleanup()
      resolve(reply)
    })
    signal.addEventListener('abort', abort, { once: true })
    running.worker.postMessage({ id, input, calculator })

    return promise
  }

  async function calculate(
    input: ScoreEngineInput,
    calculator: CharacterScoreCalculator,
    signal: AbortSignal
  ): Promise<ScoreEngineResult | null> {
    signal.throwIfAborted()
    if (state.kind === 'idle') {
      start()
    } else if (state.kind === 'stopped') {
      report('SCORE_ENGINE_FAILED')
    }

    if (state.kind !== 'running') {
      return null
    }
    const reply = await request(state.running, input, calculator, signal)
    if (reply === null) {
      return null
    }

    if (reply.elapsedMs > SLOW_SCORE_MS) {
      report('SCORE_ENGINE_SLOW')
    }
    const result = reply.text !== null ? parseResult(reply.text, calculator) : null
    if (result === null) {
      report('SCORE_ENGINE_FAILED')
    }

    return result
  }

  function dispose(): void {
    if (state.kind === 'running') {
      finish(state.running.worker, { kind: 'unavailable' }, null)
    }
    state = { kind: 'unavailable' }
  }

  return { calculate, prepare, dispose }
}
