import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readEngineInput } from './details-test-fixture'
import { SCORE_LIBRARY_FILE_NAMES } from './engine'
import { openNativeScore, type ScoreLibrary } from './native'
import { SCORE_WARMUP_INPUT } from './warmup-input'

const LIBRARY_PATH = '/synthetic/libdnfscore.dylib'
const NATIVE_OUTPUT = { native: 'output' }
const ENGINE_OUTPUT = JSON.stringify({ calculator: 'equipment', score: 1741 })

type NativeBehavior = {
  version?: unknown
  status?: number
  output?: string | null
  throwOnScore?: boolean
  missing?: string
}

function nativeEngine(behavior: NativeBehavior = {}) {
  const { version = '0.1.0', status = 0, throwOnScore = false } = behavior
  const output = behavior.output === undefined ? ENGINE_OUTPUT : behavior.output
  const scoreCalls: unknown[][] = []
  const freed: unknown[] = []
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

  return {
    scoreCalls,
    freed,
    options: { path: LIBRARY_PATH, load: () => library, decode }
  }
}

describe('점수 엔진 라이브러리 열기', () => {
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
  ] as const)('%s이면 원문 오류 없이 null을 돌려준다', (_name, behavior) => {
    const native = nativeEngine('missing' in behavior || 'version' in behavior ? behavior : {})
    const load = 'load' in behavior ? behavior.load : native.options.load

    expect(openNativeScore({ ...native.options, load })).toBeNull()
  })
})

describe('점수 엔진 네이티브 호출', () => {
  const input = readEngineInput('dealer-blade')

  it('입력 문서를 UTF-8 길이와 함께 넘기고 결과 원문을 돌려준 뒤 출력을 엔진으로 해제한다', () => {
    const native = nativeEngine()
    const score = openNativeScore(native.options)!

    expect(score(input, 'equipment')).toBe(ENGINE_OUTPUT)
    const [json, length, calculator] = native.scoreCalls[0]
    expect(JSON.parse(json as string)).toEqual(input)
    expect(length).toBe(Buffer.byteLength(json as string, 'utf8'))
    expect(calculator).toBe('equipment')
    expect(native.freed).toEqual([NATIVE_OUTPUT])
  })

  it.each([
    ['0이 아닌 반환값', { status: 2 }, true],
    ['출력 없음', { output: null }, false],
    ['네이티브 호출 예외', { throwOnScore: true }, false]
  ] as const)('%s이면 null을 돌려주고 받은 출력은 해제한다', (_name, behavior, allocated) => {
    const native = nativeEngine(behavior)
    const score = openNativeScore(native.options)!

    expect(score(input, 'equipment')).toBeNull()
    expect(native.freed).toEqual(allocated ? [NATIVE_OUTPUT] : [])
  })
})

const libraryFileName = SCORE_LIBRARY_FILE_NAMES[process.platform]
const realLibraryPath =
  libraryFileName === undefined
    ? null
    : fileURLToPath(
        new URL(`../../../../../packages/models/score-engine/${libraryFileName}`, import.meta.url)
      )

// 점수 엔진 submodule을 받은 checkout에서만 실제 라이브러리로 확인한다.
describe.skipIf(realLibraryPath === null || !existsSync(realLibraryPath))(
  '실제 점수 엔진의 준비 입력',
  () => {
    it.each(['equipment', 'buff'] as const)(
      '준비 입력을 %s 계산기가 오류 없이 계산 결과로 받는다',
      (calculator) => {
        const score = openNativeScore({ path: realLibraryPath! })!

        const text = score(SCORE_WARMUP_INPUT, calculator)

        expect(text).not.toBeNull()
        expect(JSON.parse(text!)).toMatchObject({ calculator })
      }
    )
  }
)
