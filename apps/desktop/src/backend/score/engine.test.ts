import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiagnosticCode } from '../../preload/common/types/diagnostics'
import { readEngineInput } from './details-test-fixture'
import { createScoreEngine, resolveScoreLibraryPath } from './engine'
import type { ScoreWorkerMessage, ScoreWorkerRequest } from './worker-protocol'

const LIBRARY_PATH = '/synthetic/libdnfscore.dylib'
const engineResult = {
  calculator: 'equipment',
  score: 1741,
  skipped: null,
  approximate_score: null,
  approximate_source: null,
  warning: null,
  versions: { package: 'dnfscore-native 0.3.1', rules_rev: 'rev14', bundle_id: 'phase32-rev14b' },
  display: { role: 'dealer', switchingLevel: 3, buff30: null, buff50: null }
}
const skippedResult = {
  ...engineResult,
  score: null,
  skipped: { kind: 'resolution', message: '판정 불가' }
}
const approximateResult = {
  ...skippedResult,
  approximate_score: 1650,
  approximate_source: 'legacy_fusion_policy_a',
  warning: '근사값, 1% 밖일 가능성 높음: 판정 불가'
}
const input = readEngineInput('dealer-blade')

/** Node worker의 메시지, 오류, 종료 이벤트만 흉내 낸다. 응답은 테스트가 정한다. */
class FakeWorker extends EventEmitter {
  readonly requests: ScoreWorkerRequest[] = []
  terminated = false

  postMessage(request: ScoreWorkerRequest): void {
    this.requests.push(request)
  }

  terminate(): void {
    this.terminated = true
  }

  send(message: ScoreWorkerMessage): void {
    this.emit('message', message)
  }

  reply(text: string | null, elapsedMs = 2, request = this.requests.at(-1)!): void {
    this.send({ kind: 'result', id: request.id, text, elapsedMs })
  }
}

function scoreEngine(path: string | null = LIBRARY_PATH) {
  const workers: FakeWorker[] = []
  const reports: DiagnosticCode[] = []
  const spawn = vi.fn((_data: { path: string }) => {
    const worker = new FakeWorker()
    workers.push(worker)

    return worker
  })
  const engine = createScoreEngine({ path, spawn, report: (code) => reports.push(code) })

  return { engine, workers, reports, spawn }
}

function calculate(
  engine: ReturnType<typeof scoreEngine>['engine'],
  signal = new AbortController().signal
) {
  return engine.calculate(input, 'equipment', signal)
}

describe('점수 엔진 라이브러리 위치', () => {
  const location = {
    isPackaged: false,
    platform: 'win32' as const,
    resourcesPath: 'C:\\DFragon\\resources',
    appPath: '/repo/apps/desktop',
    env: {}
  }

  it('패키지는 환경변수를 무시하고 asar 밖으로 푼 resources/score만 쓴다', () => {
    expect(
      resolveScoreLibraryPath({
        ...location,
        isPackaged: true,
        env: { DFRAGON_SCORE_LIBRARY: '/elsewhere/dnfscore.dll' }
      })
    ).toBe(
      join('C:\\DFragon\\resources', 'app.asar.unpacked', 'resources', 'score', 'dnfscore.dll')
    )
  })

  it('개발 실행은 절대 경로의 DFRAGON_SCORE_LIBRARY를 쓰고 없으면 앱의 resources/score를 쓴다', () => {
    const configured = '/engine/build/libdnfscore.dylib'
    expect(
      resolveScoreLibraryPath({
        ...location,
        platform: 'darwin',
        env: { DFRAGON_SCORE_LIBRARY: configured }
      })
    ).toBe(configured)
    expect(resolveScoreLibraryPath({ ...location, platform: 'darwin' })).toBe(
      join('/repo/apps/desktop', 'resources', 'score', 'libdnfscore.dylib')
    )
  })

  it('상대 경로 설정과 라이브러리 이름이 없는 플랫폼은 엔진 없이 실행한다', () => {
    expect(
      resolveScoreLibraryPath({ ...location, env: { DFRAGON_SCORE_LIBRARY: 'dnfscore.dll' } })
    ).toBeNull()
    expect(resolveScoreLibraryPath({ ...location, platform: 'aix' })).toBeNull()
  })
})

describe('점수 worker 준비와 계산 요청', () => {
  it('캡처 준비는 라이브러리 경로로 worker 하나를 띄우고 이후 계산을 모두 그 worker에 보낸다', async () => {
    const { engine, workers, reports, spawn } = scoreEngine()

    engine.prepare()
    engine.prepare()
    const first = calculate(engine)
    workers[0].reply(JSON.stringify({ ...engineResult, breakdown: { D18: 1 } }))
    const second = engine.calculate(input, 'buff', new AbortController().signal)
    workers[0].reply(JSON.stringify({ ...engineResult, calculator: 'buff' }))

    expect(await first).toEqual(engineResult)
    expect(await second).toEqual({ ...engineResult, calculator: 'buff' })
    expect(spawn).toHaveBeenCalledExactlyOnceWith({ path: LIBRARY_PATH })
    expect(workers[0].requests).toMatchObject([
      { input, calculator: 'equipment' },
      { input, calculator: 'buff' }
    ])
    expect(reports).toEqual([])
  })

  it('준비 전에 점수를 계산하면 그때 worker를 띄운다', async () => {
    const { engine, workers, spawn } = scoreEngine()

    const result = calculate(engine)
    workers[0].reply(JSON.stringify(engineResult))

    expect(await result).toEqual(engineResult)
    expect(spawn).toHaveBeenCalledOnce()
  })

  it('라이브러리 경로가 없으면 worker를 띄우지 않고 진단을 한 번만 남긴다', async () => {
    const { engine, reports, spawn } = scoreEngine(null)

    engine.prepare()

    expect(await calculate(engine)).toBeNull()
    expect(await calculate(engine)).toBeNull()
    expect(spawn).not.toHaveBeenCalled()
    expect(reports).toEqual(['SCORE_ENGINE_UNAVAILABLE'])
  })

  it('worker가 라이브러리를 열지 못하면 기다리던 계산을 비우고 다시 띄우지 않는다', async () => {
    const { engine, workers, reports, spawn } = scoreEngine()
    engine.prepare()
    const pending = calculate(engine)

    workers[0].send({ kind: 'unavailable' })
    engine.prepare()

    expect(await pending).toBeNull()
    expect(await calculate(engine)).toBeNull()
    expect(workers[0].terminated).toBe(true)
    expect(spawn).toHaveBeenCalledOnce()
    expect(reports).toEqual(['SCORE_ENGINE_UNAVAILABLE'])
  })
})

describe('점수 worker 결과 검증', () => {
  it.each([
    ['계산하지 못함', null],
    ['JSON이 아닌 출력', 'not json'],
    ['다른 계산기 결과', JSON.stringify({ ...engineResult, calculator: 'buff' })],
    [
      '점수와 건너뛰기 사유가 함께 있음',
      JSON.stringify({ ...engineResult, skipped: { kind: 'x', message: 'y' } })
    ],
    ['점수도 사유도 없음', JSON.stringify({ ...engineResult, score: null })],
    ['소수 점수', JSON.stringify({ ...engineResult, score: 1741.5 })],
    [
      '점수와 근사값이 함께 있음',
      JSON.stringify({ ...approximateResult, score: 1741, skipped: null })
    ],
    [
      '근사값만 있고 출처와 경고가 없음',
      JSON.stringify({ ...skippedResult, approximate_score: 1650 })
    ],
    [
      '출처만 있고 근사값이 없음',
      JSON.stringify({ ...approximateResult, approximate_score: null })
    ],
    ['근사값과 출처만 있고 경고가 없음', JSON.stringify({ ...approximateResult, warning: null })],
    [
      '건너뛴 결과에 근사값 없이 경고만 있음',
      JSON.stringify({ ...skippedResult, warning: '아바타 레코드 없음' })
    ],
    ['소수 근사값', JSON.stringify({ ...approximateResult, approximate_score: 1650.5 })],
    [
      '빈 버전 칸',
      JSON.stringify({ ...engineResult, versions: { ...engineResult.versions, rules_rev: '' } })
    ],
    [
      '알 수 없는 표시 역할',
      JSON.stringify({ ...engineResult, display: { ...engineResult.display, role: 'x' } })
    ]
  ] as const)('%s이면 점수 없이 계산 실패 진단을 남긴다', async (_name, text) => {
    const { engine, workers, reports } = scoreEngine()

    const result = calculate(engine)
    workers[0].reply(text)

    expect(await result).toBeNull()
    expect(reports).toEqual(['SCORE_ENGINE_FAILED'])
  })

  it.each([
    ['근사값이 없는 건너뛴 결과', skippedResult],
    ['건너뛴 결과에 엔진이 더한 근사값, 출처, 경고', approximateResult],
    [
      '정확한 점수에 붙은 경고',
      { ...engineResult, warning: '버프 효과에 닿지 않는 부위의 아바타가 번들에 없음' }
    ]
  ])('%s는 그대로 돌려준다', async (_name, expected) => {
    const { engine, workers, reports } = scoreEngine()

    const result = calculate(engine)
    workers[0].reply(JSON.stringify(expected))

    expect(await result).toEqual(expected)
    expect(reports).toEqual([])
  })

  it('건너뛴 버프 점수 결과의 근사값, 출처, 경고도 점수와 따로 돌려준다', async () => {
    const buffApproximate = {
      ...approximateResult,
      calculator: 'buff',
      approximate_source: 'missing_avatar_record',
      display: { role: 'buffer', switchingLevel: 3, buff30: 1, buff50: 2 }
    }
    const { engine, workers } = scoreEngine()

    const result = engine.calculate(input, 'buff', new AbortController().signal)
    workers[0].reply(JSON.stringify(buffApproximate))

    expect(await result).toEqual(buffApproximate)
  })

  it('근사값 칸을 보내지 않는 rev14 이전 엔진의 결과는 근사값 없이 받는다', async () => {
    const { approximate_score, approximate_source, warning, ...rev12 } = {
      ...skippedResult,
      versions: { package: '0.1.0', rules_rev: 'rev12', bundle_id: 'phase31-rev12' }
    }
    const { engine, workers } = scoreEngine()

    const result = calculate(engine)
    workers[0].reply(JSON.stringify(rev12))

    expect(await result).toEqual({
      ...rev12,
      approximate_score: null,
      approximate_source: null,
      warning: null
    })
  })

  it('worker가 잰 계산 시간이 50ms를 넘으면 결과는 그대로 쓰고 느린 호출 진단을 남긴다', async () => {
    const { engine, workers, reports } = scoreEngine()

    const atLimit = calculate(engine)
    workers[0].reply(JSON.stringify(engineResult), 50)
    expect(await atLimit).toEqual(engineResult)
    expect(reports).toEqual([])
    const slow = calculate(engine)
    workers[0].reply(JSON.stringify(engineResult), 51)

    expect(await slow).toEqual(engineResult)
    expect(reports).toEqual(['SCORE_ENGINE_SLOW'])
  })
})

describe('점수 worker 실패와 정리', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['오류로 끝남', (worker: FakeWorker) => worker.emit('error', new Error('worker failed'))],
    ['예고 없이 종료됨', (worker: FakeWorker) => worker.emit('exit', 1)]
  ])(
    'worker가 %s이면 기다리던 점수만 비우고 다음 캡처 준비 때 새 worker를 띄운다',
    async (_name, stop) => {
      const { engine, workers, reports, spawn } = scoreEngine()
      engine.prepare()
      const pending = calculate(engine)

      stop(workers[0])

      expect(await pending).toBeNull()
      expect(workers[0].terminated).toBe(true)
      expect(await calculate(engine)).toBeNull()
      expect(spawn).toHaveBeenCalledOnce()
      expect(reports).toEqual(['SCORE_ENGINE_FAILED', 'SCORE_ENGINE_FAILED'])
      engine.prepare()
      const next = calculate(engine)
      workers[1].reply(JSON.stringify(engineResult))
      expect(await next).toEqual(engineResult)
    }
  )

  it('worker가 응답하지 않으면 점수를 비우고 worker를 정리하며 늦은 응답은 버린다', async () => {
    vi.useFakeTimers()
    const { engine, workers, reports } = scoreEngine()
    const pending = calculate(engine)

    await vi.advanceTimersByTimeAsync(60_000)

    expect(await pending).toBeNull()
    expect(workers[0].terminated).toBe(true)
    expect(reports).toEqual(['SCORE_ENGINE_FAILED'])
    workers[0].reply(JSON.stringify(engineResult))
    expect(reports).toEqual(['SCORE_ENGINE_FAILED'])
  })

  it('취소된 계산은 응답을 기다리지 않고 취소 이유로 끝나며 늦은 응답은 버린다', async () => {
    const { engine, workers, reports } = scoreEngine()
    const controller = new AbortController()
    const cancelled = calculate(engine, controller.signal)
    const request = workers[0].requests[0]

    controller.abort(new Error('cancelled'))

    await expect(cancelled).rejects.toThrow('cancelled')
    workers[0].reply('not json', 2, request)
    const next = calculate(engine)
    workers[0].reply(JSON.stringify(engineResult))
    expect(await next).toEqual(engineResult)
    expect(workers[0].terminated).toBe(false)
    expect(reports).toEqual([])
  })

  it('앱을 끝내면 worker를 정리하고 기다리던 점수를 비운 뒤 다시 띄우지 않는다', async () => {
    const { engine, workers, reports, spawn } = scoreEngine()
    engine.prepare()
    const pending = calculate(engine)

    engine.dispose()
    engine.prepare()

    expect(await pending).toBeNull()
    expect(await calculate(engine)).toBeNull()
    expect(workers[0].terminated).toBe(true)
    expect(spawn).toHaveBeenCalledOnce()
    expect(reports).toEqual([])
  })
})
