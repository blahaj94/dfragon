import type {
  PortraitColorPolicy,
  PortraitColorScore,
  PortraitColorScorer
} from '../../src/backend/search/portrait-color'
import { buildHudPortrait } from './hud-portrait'
import type { LoadedCase } from './manifest'

export type CandidateResult = Readonly<{
  id: string
  correct: boolean
  /** 비교기가 null을 돌려준 후보. 점수가 없다. */
  score: PortraitColorScore | null
}>

export type ExclusionReason = 'correct-image-missing' | 'single-candidate'

export type CaseResult = Readonly<{
  caseId: string
  gridSize: number
  /** 이미지가 있어 점수를 구한 후보 수. */
  comparedCandidates: number
  /** manifest에서 image가 null이라 건너뛴 후보 id. */
  skippedCandidateIds: readonly string[]
  candidates: readonly CandidateResult[]
  /** 정답보다 distance가 작거나 같은 오답 수 + 1. 정답 점수가 null이면 비교한 후보 수(최하위). */
  rank: number | null
  correctDistance: number | null
  correctCoverage: number | null
  /** 오답 중 가장 작은 distance. */
  bestWrongDistance: number | null
  /** bestWrongDistance - correctDistance. 정답이 1위면 양수, 아니면 0 이하다. */
  margin: number | null
  elapsedMs: number
  /** 값이 있으면 1위 정확도와 margin 요약에서 뺀다. */
  excludedReason: ExclusionReason | null
}>

export type EvaluationSummary = Readonly<{
  gridSize: number
  totalCases: number
  /** 1위 정확도와 margin 요약에 포함한 케이스 수. */
  evaluatedCases: number
  excludedCases: number
  top1Count: number
  top1Accuracy: number | null
  /** 점수가 있는 모든 케이스의 정답 distance 최댓값. */
  maxCorrectDistance: number | null
  /** 정답이 1위가 아닌 케이스에서 1위가 된 오답의 distance 최솟값. */
  minWrongTop1Distance: number | null
  /** 모든 케이스의 오답 distance 최솟값. */
  minWrongDistance: number | null
  /** 정답이 1위인 케이스의 margin 최솟값. */
  minCorrectTop1Margin: number | null
  nullScoreCount: number
}>

function minimum(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null
  }

  return Math.min(...values)
}

function maximum(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null
  }

  return Math.max(...values)
}

function distancesOf(candidates: readonly CandidateResult[]): number[] {
  return candidates.flatMap((candidate) => (candidate.score ? [candidate.score.distance] : []))
}

export async function evaluateCase(input: {
  loaded: LoadedCase
  gridSize: number
  scorer: PortraitColorScorer
  signal: AbortSignal
}): Promise<CaseResult> {
  const { loaded, gridSize, scorer, signal } = input
  const withImage = loaded.candidates.flatMap((candidate) =>
    candidate.image ? [{ ...candidate, image: candidate.image }] : []
  )
  const skippedCandidateIds = loaded.candidates
    .filter((candidate) => candidate.image === null)
    .map((candidate) => candidate.id)
  const correct = loaded.candidates.find((candidate) => candidate.correct)
  const base = { caseId: loaded.id, gridSize, skippedCandidateIds }
  if (correct?.image == null) {
    return {
      ...base,
      comparedCandidates: 0,
      candidates: [],
      rank: null,
      correctDistance: null,
      correctCoverage: null,
      bestWrongDistance: null,
      margin: null,
      elapsedMs: 0,
      excludedReason: 'correct-image-missing'
    }
  }

  const portrait = buildHudPortrait(loaded.hud, loaded.rasterScale)
  const candidates: CandidateResult[] = []
  const startedAt = performance.now()
  for (const candidate of withImage) {
    const score = await scorer({ portrait, candidate: candidate.image, signal })
    candidates.push({ id: candidate.id, correct: candidate.correct, score })
  }
  const elapsedMs = performance.now() - startedAt

  const correctScore = candidates.find((candidate) => candidate.correct)?.score ?? null
  const wrongDistances = distancesOf(candidates.filter((candidate) => !candidate.correct))
  const bestWrongDistance = minimum(wrongDistances)
  const rank = correctScore
    ? 1 + wrongDistances.filter((distance) => distance <= correctScore.distance).length
    : candidates.length
  const margin =
    correctScore && bestWrongDistance !== null ? bestWrongDistance - correctScore.distance : null

  const correctDistance = correctScore?.distance ?? null
  const correctCoverage = correctScore?.coverage ?? null
  const excludedReason = candidates.length < 2 ? 'single-candidate' : null

  return {
    ...base,
    comparedCandidates: candidates.length,
    candidates,
    rank,
    correctDistance,
    correctCoverage,
    bestWrongDistance,
    margin,
    elapsedMs,
    excludedReason
  }
}

export function summarize(gridSize: number, results: readonly CaseResult[]): EvaluationSummary {
  const ranked = results.filter((result) => result.excludedReason === null)
  const winners = ranked.filter((result) => result.rank === 1)
  const losers = ranked.filter((result) => result.rank !== 1)
  const allCandidates = results.flatMap((result) => result.candidates)

  const top1Accuracy = ranked.length === 0 ? null : winners.length / ranked.length

  const maxCorrectDistance = maximum(
    results.flatMap((result) => (result.correctDistance === null ? [] : [result.correctDistance]))
  )
  const minWrongTop1Distance = minimum(
    losers.flatMap((result) =>
      result.bestWrongDistance === null ? [] : [result.bestWrongDistance]
    )
  )
  const minWrongDistance = minimum(
    results.flatMap((result) =>
      result.bestWrongDistance === null ? [] : [result.bestWrongDistance]
    )
  )
  const minCorrectTop1Margin = minimum(
    winners.flatMap((result) => (result.margin === null ? [] : [result.margin]))
  )
  const nullScoreCount = allCandidates.filter((candidate) => candidate.score === null).length

  return {
    gridSize,
    totalCases: results.length,
    evaluatedCases: ranked.length,
    excludedCases: results.length - ranked.length,
    top1Count: winners.length,
    top1Accuracy,
    maxCorrectDistance,
    minWrongTop1Distance,
    minWrongDistance,
    minCorrectTop1Margin,
    nullScoreCount
  }
}

export type PolicyBase = Omit<PortraitColorPolicy, 'gridSize'>
