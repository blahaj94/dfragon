import type {
  PortraitColorPolicy,
  PortraitColorScore,
  PortraitColorScorer
} from '../../src/backend/search/portrait-color'
import { portraitAnchorOf } from '../../src/backend/search/portrait-anchor'
import { buildHudPortrait } from './hud-portrait'
import type { LoadedCase } from './manifest'

export type CandidateResult = Readonly<{
  id: string
  correct: boolean
  score: PortraitColorScore | null
}>

export type ExclusionReason = 'correct-image-missing' | 'single-candidate'

export type CaseResult = Readonly<{
  caseId: string
  gridSize: number
  comparedCandidates: number
  skippedCandidateIds: readonly string[]
  candidates: readonly CandidateResult[]
  rank: number | null
  correctDistance: number | null
  correctCoverage: number | null
  bestWrongDistance: number | null
  margin: number | null
  elapsedMs: number
  excludedReason: ExclusionReason | null
}>

export type EvaluationSummary = Readonly<{
  gridSize: number
  totalCases: number
  evaluatedCases: number
  excludedCases: number
  top1Count: number
  top1Accuracy: number | null
  maxCorrectDistance: number | null
  minWrongTop1Distance: number | null
  minWrongDistance: number | null
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
  anchors: boolean
  signal: AbortSignal
}): Promise<CaseResult> {
  const { loaded, gridSize, scorer, anchors, signal } = input
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
    const anchor = anchors ? portraitAnchorOf(candidate.jobName) : null
    const score = await scorer({ portrait, candidate: candidate.image, anchor, signal })
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
