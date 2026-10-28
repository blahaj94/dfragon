import { parseDNFRaidValueNotation, type DNFRaidValueNotation } from '@dfragon/lib'
import type {
  CharacterSelectionMethod,
  RaidRowObservation
} from '../../preload/common/types/search'
import type { CharacterCandidate } from '../../preload/common/types/character'
import { orderedCandidates } from './candidate-order'
import { matchJobName } from './raid-job-name'

const FAME_MAX_DISTANCE = 2_000
const FAME_MIN_MARGIN = 2_000
export type RaidObservedValues = Readonly<{
  jobText: string | null
  valueColumn: RaidRowObservation['valueColumn']
  value: DNFRaidValueNotation | null
}>

export const NO_RAID_OBSERVED_VALUES: RaidObservedValues = {
  jobText: null,
  valueColumn: 'unknown',
  value: null
}

export function toRaidObservedValues(row: RaidRowObservation | undefined): RaidObservedValues {
  if (row === undefined) {
    return NO_RAID_OBSERVED_VALUES
  }
  const value = row.valueText === null ? null : parseDNFRaidValueNotation(row.valueText)

  return { jobText: row.jobText, valueColumn: row.valueColumn, value }
}

export type RaidComparisonPlan = Readonly<
  | { kind: 'job'; candidate: CharacterCandidate }
  | { kind: 'fame'; group: readonly CharacterCandidate[]; value: DNFRaidValueNotation }
  | { kind: 'highest-fame'; group: readonly CharacterCandidate[] }
>

export type RaidCandidateSelection = Readonly<{
  candidate: CharacterCandidate
  selectionMethod: CharacterSelectionMethod
  choices?: readonly CharacterCandidate[]
}>

function jobGroup(
  jobText: string | null,
  candidates: readonly CharacterCandidate[]
): readonly CharacterCandidate[] {
  if (jobText === null) {
    return []
  }

  return candidates.filter(
    (candidate) =>
      candidate.jobGrowName !== null && matchJobName(jobText, candidate.jobGrowName) !== null
  )
}

export function planRaidComparison({
  observed,
  candidates
}: {
  observed: RaidObservedValues
  candidates: readonly CharacterCandidate[]
}): RaidComparisonPlan | null {
  const ordered = orderedCandidates(candidates)
  if (ordered.length === 0) {
    return null
  }
  const matched = jobGroup(observed.jobText, ordered)
  if (matched.length === 1) {
    return { kind: 'job', candidate: matched[0] }
  }
  const group = matched.length === 0 ? ordered : matched
  const { valueColumn, value } = observed
  if (valueColumn === 'fame' && value !== null) {
    return { kind: 'fame', group, value }
  }

  return { kind: 'highest-fame', group }
}

type Measured = Readonly<{
  candidate: CharacterCandidate
  distance: number | null
  value: number | null
}>

function distanceToNotation(notation: DNFRaidValueNotation, value: number): number {
  if (value < notation.min) {
    return notation.min - value
  }

  if (value > notation.max) {
    return value - notation.max
  }

  return 0
}

function measure(
  notation: DNFRaidValueNotation,
  values: readonly Readonly<{ candidate: CharacterCandidate; value: number | null }>[]
): Measured[] {
  return values.map(({ candidate, value }) => {
    const distance = value === null ? null : distanceToNotation(notation, value)

    return { candidate, value, distance }
  })
}

function closest(
  measured: readonly Measured[]
): (Measured & { distance: number; value: number }) | null {
  let best: (Measured & { distance: number; value: number }) | null = null
  for (const entry of measured) {
    const { distance, value } = entry
    if (distance !== null && value !== null && (best === null || distance < best.distance)) {
      best = { ...entry, distance, value }
    }
  }

  return best
}

function isConfident(
  measured: readonly Measured[],
  best: Measured & { distance: number },
  tolerance: number,
  margin: number
): boolean {
  const others = measured.filter(({ candidate }) => candidate !== best.candidate)
  if (others.some(({ distance }) => distance === null)) {
    return false
  }
  const runnerUp = Math.min(...others.map(({ distance }) => distance ?? Infinity))

  return best.distance <= tolerance && runnerUp - best.distance >= margin
}

function highestFame(group: readonly CharacterCandidate[]): RaidCandidateSelection {
  if (group.length === 1) {
    return { candidate: group[0], selectionMethod: 'highest-fame' }
  }

  return { candidate: group[0], selectionMethod: 'highest-fame', choices: group }
}

export function selectRaidCandidate(plan: RaidComparisonPlan): RaidCandidateSelection {
  if (plan.kind === 'job') {
    return { candidate: plan.candidate, selectionMethod: 'job' }
  }

  if (plan.kind === 'highest-fame') {
    return highestFame(plan.group)
  }
  const measured = measure(
    plan.value,
    plan.group.map((candidate) => ({ candidate, value: candidate.fame }))
  )
  const best = closest(measured)
  if (best === null) {
    return highestFame(plan.group)
  }

  if (plan.group.length === 1 || isConfident(measured, best, FAME_MAX_DISTANCE, FAME_MIN_MARGIN)) {
    return { candidate: best.candidate, selectionMethod: plan.kind }
  }

  return { candidate: best.candidate, selectionMethod: plan.kind, choices: plan.group }
}
