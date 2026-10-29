export const GRADE_RARITY_NAMES = {
  common: '커먼',
  uncommon: '언커먼',
  epic: '에픽',
  primordial: '태초'
} as const

export type GradeRarity = keyof typeof GRADE_RARITY_NAMES

// 2026-10-30 사용자 결정의 구간: 커먼 0~49, 언커먼 50~89, 에픽 90~95, 태초 96~100.
export function gradeRarity(percent: number): GradeRarity {
  if (percent >= 96) {
    return 'primordial'
  }

  if (percent >= 90) {
    return 'epic'
  }

  if (percent >= 50) {
    return 'uncommon'
  }

  return 'common'
}
