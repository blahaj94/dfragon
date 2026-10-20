import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { DiagnosticCode } from '../../preload/common/types/diagnostics'
import { readEngineInput } from './details-test-fixture'
import {
  createLazyScoreEngine,
  loadScoreEngine,
  resolveScoreLibraryPath,
  type ScoreLibrary
} from './engine'

const LIBRARY_PATH = '/synthetic/libdnfscore.dylib'
const NATIVE_OUTPUT = { native: 'output' }
const engineResult = {
  calculator: 'equipment',
  score: 1741,
  skipped: null,
  versions: { package: '0.1.0', rules_rev: 'rev12', bundle_id: 'phase31-rev12' },
  display: { role: 'dealer', switchingLevel: 3, buff30: null, buff50: null }
}

type NativeBehavior = {
  version?: unknown
  status?: number
  output?: string | null
  throwOnScore?: boolean
  missing?: string
}

function nativeEngine(behavior: NativeBehavior = {}) {
  const { version = '0.1.0', status = 0, throwOnScore = false } = behavior
  const output =
    behavior.output === undefined
      ? JSON.stringify({ ...engineResult, breakdown: { D18: 1 } })
      : behavior.output
  const scoreCalls: unknown[][] = []
  const freed: unknown[] = []
  const loaded: string[] = []
  const library: ScoreLibrary = {
    func(definition) {
      if (behavior.missing !== undefined && definition.includes(behavior.missing)) {
        throw new Error(`symbol not found in ${LIBRARY_PATH}`)
      }

      if (definition.includes('dnfscore_version')) {
        return () => version
      }

      if (definition.includes('dnfscore_score')) {
        return (...args) => {
          scoreCalls.push(args)
          // koffi는 인자 변환에 실패하면 C 함수를 부르기 전에 던지므로 출력이 할당되지 않는다.
          if (throwOnScore) {
            throw new TypeError('native argument conversion failed')
          }
          const out = args[3] as unknown[]
          out[0] = output === null ? null : NATIVE_OUTPUT

          return status
        }
      }

      return (pointer) => {
        freed.push(pointer)
      }
    }
  }
  const decode = (pointer: unknown): string => {
    expect(pointer).toBe(NATIVE_OUTPUT)
    if (output === null) {
      throw new Error('decode called without native output')
    }

    return output
  }
  const reports: DiagnosticCode[] = []
  const load = (path: string): ScoreLibrary => {
    loaded.push(path)

    return library
  }

  return {
    scoreCalls,
    freed,
    loaded,
    reports,
    options: {
      path: LIBRARY_PATH,
      load,
      decode,
      now: () => 0,
      report: (code: DiagnosticCode) => reports.push(code)
    }
  }
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

describe('점수 엔진 로드 실패 정제', () => {
  it('경로가 없으면 라이브러리를 열지 않고 진단만 남긴다', () => {
    const native = nativeEngine()

    expect(loadScoreEngine({ ...native.options, path: null })).toBeNull()
    expect(native.loaded).toEqual([])
    expect(native.reports).toEqual(['SCORE_ENGINE_UNAVAILABLE'])
  })

  it.each([
    [
      '파일을 열 수 없음',
      {
        load: () => {
          throw new Error(`cannot open ${LIBRARY_PATH}`)
        }
      }
    ],
    ['함수 누락', { missing: 'dnfscore_free' }],
    ['빈 버전', { version: ' ' }],
    ['문자열이 아닌 버전', { version: null }]
  ] as const)('%s이면 null과 고정 진단 코드만 돌려준다', (_name, behavior) => {
    const native = nativeEngine('missing' in behavior || 'version' in behavior ? behavior : {})
    const load = 'load' in behavior ? behavior.load : native.options.load

    expect(loadScoreEngine({ ...native.options, load })).toBeNull()
    expect(native.reports).toEqual(['SCORE_ENGINE_UNAVAILABLE'])
  })
})

describe('점수 엔진 호출과 결과 검증', () => {
  const input = readEngineInput('dealer-blade')

  it('입력 문서를 UTF-8 길이와 함께 넘기고 쓰는 결과만 검증해 돌려준 뒤 출력을 엔진으로 해제한다', () => {
    const native = nativeEngine()
    const engine = loadScoreEngine(native.options)!

    const result = engine(input, 'equipment')

    expect(result).toEqual(engineResult)
    const [json, length, calculator] = native.scoreCalls[0]
    expect(JSON.parse(json as string)).toEqual(input)
    expect(length).toBe(Buffer.byteLength(json as string, 'utf8'))
    expect(calculator).toBe('equipment')
    expect(native.freed).toEqual([NATIVE_OUTPUT])
    expect(native.reports).toEqual([])
  })

  it.each([
    ['0이 아닌 반환값', { status: 2, output: JSON.stringify(engineResult) }, true],
    ['출력 없음', { output: null }, false],
    ['JSON이 아닌 출력', { output: 'not json' }, true],
    ['다른 계산기 결과', { output: JSON.stringify({ ...engineResult, calculator: 'buff' }) }, true],
    [
      '점수와 건너뛰기 사유가 함께 있음',
      { output: JSON.stringify({ ...engineResult, skipped: { kind: 'x', message: 'y' } }) },
      true
    ],
    ['점수도 사유도 없음', { output: JSON.stringify({ ...engineResult, score: null }) }, true],
    ['소수 점수', { output: JSON.stringify({ ...engineResult, score: 1741.5 }) }, true],
    [
      '빈 버전 칸',
      {
        output: JSON.stringify({
          ...engineResult,
          versions: { ...engineResult.versions, rules_rev: '' }
        })
      },
      true
    ],
    [
      '알 수 없는 표시 역할',
      {
        output: JSON.stringify({ ...engineResult, display: { ...engineResult.display, role: 'x' } })
      },
      true
    ],
    ['네이티브 호출 예외', { throwOnScore: true }, false]
  ] as const)(
    '%s이면 점수 없이 진단을 남기고 받은 출력은 해제한다',
    (_name, behavior, allocated) => {
      const native = nativeEngine(behavior)
      const engine = loadScoreEngine(native.options)!

      expect(engine(input, 'equipment')).toBeNull()
      expect(native.reports).toEqual(['SCORE_ENGINE_FAILED'])
      expect(native.freed).toEqual(allocated ? [NATIVE_OUTPUT] : [])
    }
  )

  it('건너뛴 결과는 사유와 함께 정상 결과로 돌려준다', () => {
    const skipped = {
      ...engineResult,
      score: null,
      skipped: { kind: 'resolution', message: '판정 불가' }
    }
    const native = nativeEngine({ output: JSON.stringify(skipped) })

    expect(loadScoreEngine(native.options)!(input, 'equipment')).toEqual(skipped)
    expect(native.reports).toEqual([])
  })

  it('rev14가 건너뛴 결과에 더한 근사값과 경고는 버리고 건너뛴 결과로 돌려준다', () => {
    const skipped = {
      ...engineResult,
      score: null,
      skipped: { kind: 'resolution', message: '판정 불가' },
      versions: { package: 'dnfscore-native 0.3.0', rules_rev: 'rev14', bundle_id: 'phase32-rev14' }
    }
    const native = nativeEngine({
      output: JSON.stringify({
        ...skipped,
        approximate_score: 1650,
        approximate_source: 'previous_season_fusion',
        warning: '근사값입니다'
      })
    })

    expect(loadScoreEngine(native.options)!(input, 'equipment')).toEqual(skipped)
    expect(native.reports).toEqual([])
  })

  it('계산이 50ms를 넘으면 결과는 그대로 쓰고 느린 호출 진단을 남긴다', () => {
    const native = nativeEngine()
    const times = [0, 50, 100, 151]
    const engine = loadScoreEngine({ ...native.options, now: () => times.shift()! })!

    expect(engine(input, 'equipment')).toEqual(engineResult)
    expect(native.reports).toEqual([])
    expect(engine(input, 'equipment')).toEqual(engineResult)
    expect(native.reports).toEqual(['SCORE_ENGINE_SLOW'])
  })
})

describe('첫 점수 계산 때 엔진 열기', () => {
  it('처음 호출할 때 한 번만 열고 열지 못한 결과도 다시 시도하지 않는다', () => {
    const load = vi.fn(() => null)
    const engine = createLazyScoreEngine(load)
    const input = readEngineInput('dealer-blade')

    expect(load).not.toHaveBeenCalled()
    expect(engine(input, 'equipment')).toBeNull()
    expect(engine(input, 'buff')).toBeNull()
    expect(load).toHaveBeenCalledOnce()
  })
})
