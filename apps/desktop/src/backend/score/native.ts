import koffi from 'koffi'
import type { CharacterScoreCalculator } from '../../preload/common/types/character'
import type { ScoreEngineInput } from './input'

const SCORE_SUCCESS = 0

type NativeFunction = (...args: unknown[]) => unknown
export type ScoreLibrary = Readonly<{ func(definition: string): NativeFunction }>

export type NativeScore = (
  input: ScoreEngineInput,
  calculator: CharacterScoreCalculator
) => string | null

export type NativeScoreOptions = Readonly<{
  path: string
  load?: (path: string) => ScoreLibrary
  /** 해제는 엔진의 `dnfscore_free`가 맡는다. */
  decode?: (pointer: unknown) => string
}>

function decodeNativeString(pointer: unknown): string {
  return koffi.decode(pointer, 'char', -1) as string
}

/** 라이브러리를 열지 못하면 null이다. 원문 오류는 라이브러리 경로를 담을 수 있어 돌려주지 않는다. */
export function openNativeScore(options: NativeScoreOptions): NativeScore | null {
  const {
    path,
    load = (libraryPath) => koffi.load(libraryPath) as unknown as ScoreLibrary,
    decode = decodeNativeString
  } = options
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
      return null
    }
  } catch {
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
    try {
      return callNative(input, calculator)
    } catch {
      return null
    }
  }
}
