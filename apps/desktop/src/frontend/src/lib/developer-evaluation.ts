import type { DeveloperSample } from '../../../preload/common/types/developer'

export type EvaluationPreprocessing = 'party' | 'raw'
export type DeveloperEvaluation =
  | { status: 'success'; text: string; confidence: number; milliseconds: number }
  | { status: 'failed' }

/** 유니코드 code point 단위 Levenshtein 거리를 계산해 한글을 바이트 수로 세지 않는다. */
export function characterErrors(expected: string, actual: string): number {
  const left = Array.from(expected)
  const right = Array.from(actual)
  let previous = right.map((_, index) => index + 1)
  previous.unshift(0)
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
      )
    }
    previous = current
  }
  return previous[right.length]
}

/** 미작성 라벨과 실패를 분리하고 성공한 라벨 이미지의 원문 일치율·전체 문자 오류율을 계산한다. */
export function summarizeDeveloperEvaluation(
  samples: readonly DeveloperSample[],
  results: Readonly<Record<string, DeveloperEvaluation>>
): {
  scored: number
  matched: number
  failed: number
  completed: number
  accuracy: number | null
  characterErrorRate: number | null
} {
  let scored = 0
  let matched = 0
  let errors = 0
  let characters = 0
  let failed = 0
  let completed = 0
  for (const sample of samples) {
    const result = results[sample.id]
    if (result == null) {
      continue
    }
    if (result.status === 'failed') {
      failed += 1
      continue
    }
    completed += 1
    if (sample.text == null) {
      continue
    }
    scored += 1
    if (sample.text === result.text) {
      matched += 1
    }
    errors += characterErrors(sample.text, result.text)
    characters += Array.from(sample.text).length
  }
  return {
    scored,
    matched,
    failed,
    completed,
    accuracy: scored === 0 ? null : matched / scored,
    characterErrorRate: characters === 0 ? null : errors / characters
  }
}
