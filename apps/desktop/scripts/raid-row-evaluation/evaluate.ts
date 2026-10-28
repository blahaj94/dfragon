import {
  type DNFRaidParticipantDetection,
  type DNFRaidValueColumnKind,
  type DNFRaidValueNotation,
  parseDNFRaidValueNotation
} from '@dfragon/lib'
import type { JobOcrReader } from './job-ocr'
import { matchJobName, normalizeJobName } from '../../src/backend/search/raid-job-name'
import { COLUMN_KINDS, type ManifestCandidate, type ManifestRow } from './manifest'

const K_NOTATION_PATTERN = /K$/
const WHITESPACE_PATTERN = /\s+/gu
const AWAKENING_MARK_PATTERN = /^眞/u

export const JOB_OCR_PREPROCESSINGS = ['nickname', 'raw'] as const
export type JobOcrPreprocessing = (typeof JOB_OCR_PREPROCESSINGS)[number]

export type RowObservation = Readonly<{
  caseId: string
  row: number
  resolution: string
  columnKind: DNFRaidValueColumnKind
  expected: ManifestRow
  valueText: string | null
  notation: DNFRaidValueNotation | null
  jobText: Readonly<Record<JobOcrPreprocessing, string>> | null
}>

export type CaseObservation = Readonly<{
  caseId: string
  resolution: string
  detection: DNFRaidParticipantDetection['status']
  matchScore: number | null
  expectedKind: DNFRaidValueColumnKind
  observedKind: DNFRaidValueColumnKind | null
  rows: readonly RowObservation[]
}>

type Rate = { matched: number; total: number }
type NotRun = { status: 'not_run'; reason: string }

export type JobOcrSummary = Readonly<{
  exactRaw: Rate
  exactWithoutSpaceAndMark: Rate
  exactNormalized: Rate
  ruleMatched: Rate
  ruleFalseMatched: Rate
}>

export type CandidateSummary =
  | NotRun
  | Readonly<{
      status: 'run'
      screenJobField: Readonly<{ jobGrowName: number; jobName: number; neither: number }>
      fameDifferences: readonly number[]
      fameGaps: readonly number[]
    }>

export type EvaluationSummary = Readonly<{
  coverage: Readonly<{
    images: number
    rows: number
    resolutions: Readonly<Record<string, number>>
    columnKinds: Readonly<Record<DNFRaidValueColumnKind, number>>
    kNotationRows: number
    clippedJobRows: number
    uniqueName: Readonly<{ unique: number; homonym: number; unknown: number }>
  }>
  detection: Readonly<Record<DNFRaidValueColumnKind, Rate & { minMatchScore: number | null }>>
  columnKind: Rate
  value: Rate &
    Readonly<{
      byResolution: Readonly<Record<string, Rate>>
      failures: readonly Readonly<{
        caseId: string
        row: number
        expected: string
        read: string | null
      }>[]
      notationMatched: Rate
    }>
  jobOcr: NotRun | Readonly<{ status: 'run' } & Record<JobOcrPreprocessing, JobOcrSummary>>
  candidates: CandidateSummary
}>

function rate(values: readonly boolean[]): Rate {
  const matched = values.filter(Boolean).length

  return { matched, total: values.length }
}

function countBy<T extends string>(values: readonly T[]): Record<T, number> {
  const counts = {} as Record<T, number>
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1
  }

  return counts
}

function withoutSpaceAndMark(text: string): string {
  return text.replace(WHITESPACE_PATTERN, '').replace(AWAKENING_MARK_PATTERN, '')
}

function sameNotation(read: DNFRaidValueNotation | null, expected: string): boolean {
  const parsed = parseDNFRaidValueNotation(expected)

  return read !== null && parsed !== null && read.min === parsed.min && read.max === parsed.max
}

function distanceToNotation(notation: DNFRaidValueNotation, value: number): number {
  if (value < notation.min) {
    return notation.min - value
  }

  if (value > notation.max) {
    return value - notation.max
  }

  return 0
}

function jobOcrSummary(
  rows: readonly RowObservation[],
  preprocessing: JobOcrPreprocessing,
  jobNames: readonly string[]
): JobOcrSummary {
  const read = rows.map((row) => {
    const text = row.jobText?.[preprocessing] ?? ''

    return { row, text }
  })
  const exactRaw = rate(read.map(({ row, text }) => text === row.expected.visibleJobText))
  const exactWithoutSpaceAndMark = rate(
    read.map(
      ({ row, text }) =>
        withoutSpaceAndMark(text) === withoutSpaceAndMark(row.expected.visibleJobText)
    )
  )
  const exactNormalized = rate(
    read.map(
      ({ row, text }) => normalizeJobName(text) === normalizeJobName(row.expected.visibleJobText)
    )
  )
  const ruleMatched = rate(
    read.map(({ row, text }) => matchJobName(text, row.expected.jobGrowName) !== null)
  )
  const ruleFalseMatched = rate(
    read.map(({ row, text }) =>
      jobNames.some(
        (name) =>
          normalizeJobName(name) !== normalizeJobName(row.expected.jobGrowName) &&
          matchJobName(text, name) !== null
      )
    )
  )

  return { exactRaw, exactWithoutSpaceAndMark, exactNormalized, ruleMatched, ruleFalseMatched }
}

function nearestGap(
  correct: ManifestCandidate,
  others: readonly ManifestCandidate[],
  field: 'fame'
): number | null {
  const value = correct[field]
  const gaps: number[] = []
  for (const other of others) {
    const otherValue = other[field]
    if (value !== null && otherValue !== null) {
      gaps.push(Math.abs(value - otherValue))
    }
  }

  if (gaps.length === 0) {
    return null
  }

  return Math.min(...gaps)
}

function candidateSummary(rows: readonly RowObservation[]): CandidateSummary {
  const withCandidates = rows.filter((row) => row.expected.candidates.length > 0)
  if (withCandidates.length === 0) {
    return { status: 'not_run', reason: '후보 명성, 직업명을 담은 행이 없습니다' }
  }
  const screenJobField = { jobGrowName: 0, jobName: 0, neither: 0 }
  const fameDifferences: number[] = []
  const fameGaps: number[] = []
  for (const row of withCandidates) {
    const correct = row.expected.candidates.find((candidate) => candidate.correct)
    if (correct === undefined) {
      continue
    }
    const screen = normalizeJobName(row.expected.jobGrowName)
    if (correct.jobGrowName !== null && normalizeJobName(correct.jobGrowName) === screen) {
      screenJobField.jobGrowName += 1
    } else if (correct.jobName !== null && normalizeJobName(correct.jobName) === screen) {
      screenJobField.jobName += 1
    } else {
      screenJobField.neither += 1
    }
    const screenNotation = parseDNFRaidValueNotation(row.expected.valueText)
    if (row.columnKind === 'fame' && screenNotation !== null && correct.fame !== null) {
      fameDifferences.push(distanceToNotation(screenNotation, correct.fame))
    }

    const sameJob = row.expected.candidates.filter(
      (candidate) =>
        !candidate.correct &&
        candidate.jobGrowName !== null &&
        correct.jobGrowName !== null &&
        normalizeJobName(candidate.jobGrowName) === normalizeJobName(correct.jobGrowName)
    )
    const fameGap = nearestGap(correct, sameJob, 'fame')
    if (fameGap !== null) {
      fameGaps.push(fameGap)
    }
  }

  return { status: 'run', screenJobField, fameDifferences, fameGaps }
}

export function summarize(
  cases: readonly CaseObservation[],
  jobOcrSkipReason: string | null
): EvaluationSummary {
  const rows = cases.flatMap((entry) => entry.rows)
  const detection = Object.fromEntries(
    COLUMN_KINDS.map((kind) => {
      const matching = cases.filter((entry) => entry.expectedKind === kind)
      const scores = matching.flatMap((entry) =>
        entry.matchScore === null ? [] : [entry.matchScore]
      )
      const found = rate(matching.map((entry) => entry.detection === 'found'))
      const minMatchScore = scores.length === 0 ? null : Math.min(...scores)

      return [kind, { ...found, minMatchScore }]
    })
  ) as Record<DNFRaidValueColumnKind, Rate & { minMatchScore: number | null }>
  const resolutions = [...new Set(rows.map((row) => row.resolution))]
  const jobNames = [...new Set(rows.map((row) => row.expected.jobGrowName))]
  const jobOcr: EvaluationSummary['jobOcr'] =
    jobOcrSkipReason === null
      ? {
          status: 'run',
          nickname: jobOcrSummary(rows, 'nickname', jobNames),
          raw: jobOcrSummary(rows, 'raw', jobNames)
        }
      : { status: 'not_run', reason: jobOcrSkipReason }
  const uniqueName = {
    unique: rows.filter((row) => row.expected.uniqueName === true).length,
    homonym: rows.filter((row) => row.expected.uniqueName === false).length,
    unknown: rows.filter((row) => row.expected.uniqueName === null).length
  }
  const resolutionCounts = countBy(rows.map((row) => row.resolution))
  const columnKinds = Object.fromEntries(
    COLUMN_KINDS.map((kind) => [kind, rows.filter((row) => row.columnKind === kind).length])
  ) as Record<DNFRaidValueColumnKind, number>
  const kNotationRows = rows.filter((row) => K_NOTATION_PATTERN.test(row.expected.valueText)).length
  const clippedJobRows = rows.filter((row) => row.expected.jobClipped).length
  const columnKind = rate(cases.map((entry) => entry.observedKind === entry.expectedKind))
  const valueRate = rate(rows.map((row) => row.valueText === row.expected.valueText))
  const byResolution = Object.fromEntries(
    resolutions.map((resolution) => [
      resolution,
      rate(
        rows
          .filter((row) => row.resolution === resolution)
          .map((row) => row.valueText === row.expected.valueText)
      )
    ])
  )
  const failures = rows
    .filter((row) => row.valueText !== row.expected.valueText)
    .map((row) => ({
      caseId: row.caseId,
      row: row.row,
      expected: row.expected.valueText,
      read: row.valueText
    }))
  const notationMatched = rate(
    rows.map((row) => sameNotation(row.notation, row.expected.valueText))
  )
  const candidates = candidateSummary(rows)

  return {
    coverage: {
      images: cases.length,
      rows: rows.length,
      resolutions: resolutionCounts,
      columnKinds,
      kNotationRows,
      clippedJobRows,
      uniqueName
    },
    detection,
    columnKind,
    value: { ...valueRate, byResolution, failures, notationMatched },
    jobOcr,
    candidates
  }
}

export async function readJobText(
  reader: JobOcrReader,
  crop: Parameters<JobOcrReader>[0]
): Promise<Record<JobOcrPreprocessing, string>> {
  const result = {} as Record<JobOcrPreprocessing, string>
  for (const preprocessing of JOB_OCR_PREPROCESSINGS) {
    result[preprocessing] = await reader(crop, preprocessing)
  }

  return result
}
