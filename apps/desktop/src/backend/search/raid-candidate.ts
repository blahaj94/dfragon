import { parseDNFRaidValueNotation, type DNFRaidValueNotation } from '@dfragon/lib'
import type {
  CharacterSelectionMethod,
  RaidRowObservation
} from '../../preload/common/types/search'
import type { CharacterCandidate } from '../../preload/common/types/character'
import { orderedCandidates } from './candidate-order'
import { matchJobName } from './raid-job-name'

/** 명성 1위를 확정하는 화면 표기 범위와의 거리 상한(포함) */
const FAME_MAX_DISTANCE = 2_000
/** 명성 1위를 확정하는 2위 거리와 1위 거리의 차이 하한(포함) */
const FAME_MIN_MARGIN = 2_000
/** 공대 상세 창의 그 행에서 이름 밖에 읽은 값. 식별 규칙이 쓰는 형태로 바꾼 값이다. */
export type RaidObservedValues = Readonly<{
  /** 직업명 칸 OCR 문자열. 읽지 못했으면 null이다. */
  jobText: string | null
  valueColumn: RaidRowObservation['valueColumn']
  /** 수치 칸 표기가 보일 수 있는 값 범위. 읽지 못했거나 해석할 수 없으면 null이다. */
  value: DNFRaidValueNotation | null
}>

/** 공대 창에서 아무 값도 읽지 못한 행 */
export const NO_RAID_OBSERVED_VALUES: RaidObservedValues = {
  jobText: null,
  valueColumn: 'unknown',
  value: null
}

/** 공대 관측의 행 값을 식별 규칙의 입력으로 바꾼다. 관측이 없으면 아무 값도 읽지 못한 행이다. */
export function toRaidObservedValues(row: RaidRowObservation | undefined): RaidObservedValues {
  if (row === undefined) {
    return NO_RAID_OBSERVED_VALUES
  }
  const value = row.valueText === null ? null : parseDNFRaidValueNotation(row.valueText)

  return { jobText: row.jobText, valueColumn: row.valueColumn, value }
}

/**
 * 공대 자리 하나에서 할 비교. `group`은 직업명이 맞는 후보, 맞는 후보가 없거나 직업명을 비교할 수 없으면
 * 동명 후보 전체이며 명성 순이다.
 */
export type RaidComparisonPlan = Readonly<
  | { kind: 'job'; candidate: CharacterCandidate }
  | { kind: 'fame'; group: readonly CharacterCandidate[]; value: DNFRaidValueNotation }
  | { kind: 'highest-fame'; group: readonly CharacterCandidate[] }
>

export type RaidCandidateSelection = Readonly<{
  candidate: CharacterCandidate
  selectionMethod: CharacterSelectionMethod
  /** 확정하지 못했을 때 사용자가 고를 그룹 후보. 고른 후보를 포함한 두 명 이상이고 명성 순이다. */
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

/**
 * 공대 자리 하나의 이름 후보를 그 행의 직업명으로 좁히고 필요한 수치 비교를 정한다. 직업명이 맞는 후보가
 * 한 명이면 비교 없이 그 후보다. 맞는 후보가 없거나 직업명을 읽지 못했거나 API가 직업명을 보내지 않으면 동명
 * 후보 전체를 그룹으로 쓴다. 수치 열 종류나 수치를 읽지 못하면 그룹 안 최고 명성 후보를 고른다. 후보가
 * 없으면 null이다.
 */
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

/** 화면 표기 범위 안이면 0, 밖이면 가까운 끝과의 거리다. */
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

/** 거리가 같으면 명성 순서가 앞선 후보가 1위다. */
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

/**
 * 1위의 거리가 허용 오차 이내이고, 비교한 다른 후보 전원의 값이 있으며 그중 가장 가까운 후보의 거리가 1위
 * 거리보다 간격 이상 클 때만 확정한다. 다른 후보가 없으면 허용 오차만 본다.
 */
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

/** 명성 비교로 최선 후보와 확정 여부를 정한다. 확정하지 못하면 그룹 후보를 함께 돌려준다. */
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

  // 그룹이 한 명이면 서버가 하나뿐이라 고를 후보가 없으므로 기준과 무관하게 추정으로 두지 않는다.
  if (plan.group.length === 1 || isConfident(measured, best, FAME_MAX_DISTANCE, FAME_MIN_MARGIN)) {
    return { candidate: best.candidate, selectionMethod: plan.kind }
  }

  return { candidate: best.candidate, selectionMethod: plan.kind, choices: plan.group }
}
