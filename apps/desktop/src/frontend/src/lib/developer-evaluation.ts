import { filter, groupByProp, isNonNullish, map, pipe, sumBy } from 'remeda'
import type { DeveloperSample } from '../../../preload/common/types/developer'

export type EvaluationPreprocessing = 'party' | 'raw'
export type DeveloperEvaluation =
  | { status: 'success'; text: string; confidence: number; milliseconds: number }
  | { status: 'failed' }

type LabelScore = { matched: number; errors: number; characters: number }
type SampleEvaluation =
  | { status: 'unevaluated' }
  | { status: 'failed' }
  | { status: 'success'; score: LabelScore | null }

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

/** 미작성 라벨과 실패를 분리하고 성공한 라벨 이미지의 원문 일치율, 전체 문자 오류율을 계산한다. */
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
  const evaluations = groupByProp(collectSampleEvaluations(samples, results), 'status')
  const completed = evaluations.success?.length ?? 0
  const failed = evaluations.failed?.length ?? 0
  const scores = pipe(
    evaluations.success ?? [],
    map((evaluation) => evaluation.score),
    filter(isNonNullish)
  )
  const scored = scores.length
  const matched = sumBy(scores, (score) => score.matched)
  const errors = sumBy(scores, (score) => score.errors)
  const characters = sumBy(scores, (score) => score.characters)
  const accuracy = scored === 0 ? null : matched / scored
  const characterErrorRate = characters === 0 ? null : errors / characters

  return { scored, matched, failed, completed, accuracy, characterErrorRate }
}

/** 샘플 순서대로 결과를 조회하고 채점까지 확정해 실패, 미평가의 라벨을 읽지 않는다. */
function collectSampleEvaluations(
  samples: readonly DeveloperSample[],
  results: Readonly<Record<string, DeveloperEvaluation>>
): SampleEvaluation[] {
  const evaluations: SampleEvaluation[] = []
  for (const sample of samples) {
    const result = results[sample.id]
    if (result == null) {
      evaluations.push({ status: 'unevaluated' })
      continue
    }

    if (result.status === 'failed') {
      evaluations.push({ status: 'failed' })
      continue
    }
    const score = scoreDeveloperLabel(sample, result)
    evaluations.push({ status: 'success', score })
  }

  return evaluations
}

/** 성공한 원문만 저장 정답과 비교하고 빈 정답도 채점하되 미작성은 점수를 만들지 않는다. */
function scoreDeveloperLabel(
  sample: DeveloperSample,
  result: Extract<DeveloperEvaluation, { status: 'success' }>
): LabelScore | null {
  let score: LabelScore | null = null
  if (sample.text != null) {
    const matched = sample.text === result.text ? 1 : 0
    const errors = characterErrors(sample.text, result.text)
    const characters = Array.from(sample.text).length
    score = { matched, errors, characters }
  }

  return score
}
