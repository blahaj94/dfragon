import type { CharacterCard } from '../types/cards'

export type ScoreView = {
  label: '장비 점수' | '버프 점수'
  tone: 'dealer' | 'buffer' | null
  value: number | null
  approximate: boolean
  description: string | undefined
}

const integer = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

const skippedReasons: Readonly<Record<string, string>> = {
  input_gate: '입력값이 게임 스탯과 다름',
  resolution: '아이템을 판별하지 못함',
  unresolved: '장비 정보 부족',
  exception: '계산 오류'
}

const approximateMethods: Readonly<Record<string, string>> = {
  legacy_fusion_policy_a: '이전 시즌 융합석을 빼고 계산한 값',
  legacy_fusion_policy_a_input_gate_diagnostic:
    '이전 시즌 융합석을 빼고 입력값 차이를 무시하고 계산한 값',
  input_gate_diagnostic: '입력값 차이를 무시하고 계산한 값',
  common_level_skip_computed: '공통 스킬 레벨을 1로 두고 계산한 값',
  missing_switching_item: '판별하지 못한 버프 강화 아이템을 빼고 계산한 값'
}

const scoreNote = (label: ScoreView['label']): string =>
  `던삐삐 계산값이라 게임 ${label}와 조금 다를 수 있습니다.`

export const formatApproximateScore = (value: number): string => `≈${integer.format(value)}`

export function toScoreView(card: CharacterCard | null | undefined, pending = false): ScoreView {
  const score = card?.score
  const label = card?.role === 'buffer' ? '버프 점수' : '장비 점수'
  const labelTone = { label, tone: card?.role ?? null } as const
  if (score == null) {
    const description = pending ? '계산 중' : undefined

    return { ...labelTone, value: null, approximate: false, description }
  }

  if (score.value != null) {
    const description = scoreNote(label)

    return { ...labelTone, value: score.value, approximate: false, description }
  }

  if (score.skipped == null) {
    return { ...labelTone, value: null, approximate: false, description: undefined }
  }
  const { kind } = score.skipped
  const reason = Object.hasOwn(skippedReasons, kind) ? skippedReasons[kind] : '계산 제외'
  if (score.approximate == null) {
    const description = `계산하지 못함, ${reason}`

    return { ...labelTone, value: null, approximate: false, description }
  }
  const { value, source } = score.approximate
  const method = Object.hasOwn(approximateMethods, source)
    ? approximateMethods[source]
    : '정확히 계산하지 못한 추정값'
  const description = `근사값, ${reason}. ${method}이라 게임 ${label}와 1% 넘게 다를 수 있습니다.`

  return { ...labelTone, value, approximate: true, description }
}
