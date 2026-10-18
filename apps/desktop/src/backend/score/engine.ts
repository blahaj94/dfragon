import { isAbsolute, join } from 'node:path'
import koffi from 'koffi'
import { z } from 'zod'
import type { CharacterScoreCalculator } from '../../preload/common/types/character'
import type { DiagnosticCode } from '../../preload/common/types/diagnostics'
import { reportDiagnostic } from '../diagnostics/log'
import type { ScoreEngineInput } from './input'

/** 패키지 `resources/score/`에 두는 플랫폼별 라이브러리 이름. 입수 스크립트도 이 이름으로 배치한다. */
export const SCORE_LIBRARY_FILE_NAMES: Readonly<Partial<Record<NodeJS.Platform, string>>> = {
  win32: 'dnfscore.dll',
  darwin: 'libdnfscore.dylib',
  linux: 'libdnfscore.so'
}
const SCORE_SUCCESS = 0
const SLOW_SCORE_MS = 50

const nonblank = z.string().refine((value) => value.trim().length > 0)
const nullableNumber = z.number().nullable()
const resultSchema = z
  .object({
    calculator: z.enum(['equipment', 'buff']),
    score: z.int().nullable(),
    skipped: z.object({ kind: nonblank, message: nonblank }).nullable(),
    versions: z.object({ package: nonblank, rules_rev: nonblank, bundle_id: nonblank }),
    display: z.object({
      role: z.enum(['dealer', 'buffer']),
      switchingLevel: nullableNumber,
      buff30: nullableNumber,
      buff50: nullableNumber
    })
  })
  // 점수와 건너뛴 사유는 둘 중 하나만 있다.
  .refine((result) => (result.score === null) !== (result.skipped === null))

/** 엔진 결과 중 Desktop이 쓰는 부분. 엔진이 더 보내는 칸은 버린다. */
export type ScoreEngineResult = z.infer<typeof resultSchema>

export type ScoreEngine = (
  input: ScoreEngineInput,
  calculator: CharacterScoreCalculator
) => ScoreEngineResult | null

type NativeFunction = (...args: unknown[]) => unknown
/** `koffi.load`가 돌려주는 라이브러리 중 엔진이 쓰는 부분. 테스트는 같은 모양의 더블을 넘긴다. */
export type ScoreLibrary = Readonly<{ func(definition: string): NativeFunction }>

export type ScoreEngineOptions = Readonly<{
  path: string | null
  load?: (path: string) => ScoreLibrary
  /** 엔진이 할당한 NUL 종료 UTF-8 문자열을 읽는다. 해제는 엔진의 `dnfscore_free`가 맡는다. */
  decode?: (pointer: unknown) => string
  now?: () => number
  report?: (code: DiagnosticCode) => void
}>

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

function decodeNativeString(pointer: unknown): string {
  return koffi.decode(pointer, 'char', -1) as string
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
 * 점수 엔진 라이브러리를 열고 세 C 함수를 묶는다. 파일이 없거나 열 수 없으면 null이며 점수 없이
 * 카드를 표시한다. 호출은 main에서 동기로 실행하고 실패는 진단 코드로만 남긴다.
 */
export function loadScoreEngine(options: ScoreEngineOptions): ScoreEngine | null {
  const {
    path,
    load = (libraryPath) => koffi.load(libraryPath) as unknown as ScoreLibrary,
    decode = decodeNativeString,
    now = () => performance.now(),
    report = reportDiagnostic
  } = options
  if (path === null) {
    report('SCORE_ENGINE_UNAVAILABLE')

    return null
  }
  let scoreNative: NativeFunction
  let freeNative: NativeFunction
  try {
    const library = load(path)
    const version = library.func('const char *dnfscore_version(void)')
    scoreNative = library.func(
      'int dnfscore_score(const char *json, size_t len, const char *calculator, _Out_ void **out)'
    )
    freeNative = library.func('void dnfscore_free(void *value)')
    const engineVersion = version()
    if (typeof engineVersion !== 'string' || engineVersion.trim().length === 0) {
      throw new Error('SCORE_ENGINE_VERSION_INVALID')
    }
  } catch {
    // 원문 오류는 라이브러리 경로를 담을 수 있어 진단 코드로만 남긴다.
    report('SCORE_ENGINE_UNAVAILABLE')

    return null
  }

  function callNative(
    input: ScoreEngineInput,
    calculator: CharacterScoreCalculator
  ): string | null {
    const json = JSON.stringify(input)
    const output: unknown[] = [null]
    let pointer: unknown = null
    try {
      const status = scoreNative(json, Buffer.byteLength(json, 'utf8'), calculator, output)
      pointer = output[0] ?? null
      if (status !== SCORE_SUCCESS || pointer === null) {
        return null
      }

      return decode(pointer)
    } finally {
      // 실패 코드와 함께 돌려준 문자열도 엔진이 할당했으므로 같은 엔진으로 해제한다.
      if (pointer !== null) {
        freeNative(pointer)
      }
    }
  }

  return (input, calculator) => {
    const startedAt = now()
    let text: string | null
    try {
      text = callNative(input, calculator)
    } catch {
      text = null
    }
    if (now() - startedAt > SLOW_SCORE_MS) {
      report('SCORE_ENGINE_SLOW')
    }
    const result = text === null ? null : parseResult(text, calculator)
    if (result === null) {
      report('SCORE_ENGINE_FAILED')
    }

    return result
  }
}

/** 첫 점수 계산 때 한 번만 라이브러리를 연다. 열지 못한 결과도 기억해 다시 시도하지 않는다. */
export function createLazyScoreEngine(load: () => ScoreEngine | null): ScoreEngine {
  let engine: ScoreEngine | null | undefined

  return (input, calculator) => {
    if (engine === undefined) {
      engine = load()
    }

    if (engine === null) {
      return null
    }

    return engine(input, calculator)
  }
}
