import { MISSING_VALUE } from '../constants/cards'
import type { CardStats } from '../types/cards'

/** 스탯 한 칸. 값이 없으면 `-`이고 단위를 붙이지 않는다. */
export type CardStatItem = { label: string; value: string; unit: string }

const integer = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 })
const fixedOneDecimal = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})
const fixedTwoDecimals = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

function item(
  label: string,
  value: number | null,
  format: (value: number) => string,
  unit = ''
): CardStatItem {
  if (value == null) {
    return { label, value: MISSING_VALUE, unit: '' }
  }

  return { label, value: format(value), unit }
}

/** 스탯 한 줄의 라벨 길이. 공대 카드는 줄인 라벨, 파티 카드의 캐릭터 면은 캔버스 카드 면 보드의 긴 라벨을 쓴다. */
export type CardStatLabelLength = 'short' | 'long'

const statLabels = {
  short: { amplification: '증폭', buff30: '30레벨', buff50: '50레벨' },
  long: { amplification: '공격력 증폭', buff30: '30레벨 버프', buff50: '50레벨 버프' }
} as const

// 공격력 증가는 1억% 이상이면 억 단위 두 자리, 그보다 작으면 만 단위 정수로 줄인다(캔버스 `1.28억%`, `9,860만%`).
function attackIncreaseItem(value: number | null): CardStatItem {
  if (value != null && value < 100_000_000) {
    return item('공격력 증가', value, (percent) => integer.format(percent / 10_000), '만%')
  }

  return item(
    '공격력 증가',
    value,
    (percent) => fixedTwoDecimals.format(percent / 100_000_000),
    '억%'
  )
}

/**
 * 스탯 한 줄의 네 칸을 정한다(DFragon 디자인 캔버스의 공대 보드와 카드 면 보드). 딜러는 공격력 증가(억%나 만%),
 * 증폭, 크리티컬, 스위칭 레벨을, 버퍼는 마을 주 스탯(지능, 정신력, 체력 중 직업의 것), 30레벨과 50레벨 버프
 * 수치(만), 스위칭 레벨을 보인다.
 * 스탯이 없으면 역할을 알 수 없어 딜러 라벨로 자리만 두고 값은 모두 `-`다.
 */
export function toCardStatItems(
  stats: CardStats | null | undefined,
  labelLength: CardStatLabelLength = 'short'
): CardStatItem[] {
  const label = statLabels[labelLength]
  if (stats?.role === 'buffer') {
    return [
      item(`마을 ${stats.townStatName}`, stats.townStat, (value) => integer.format(value)),
      item(label.buff30, stats.buff30, (value) => fixedOneDecimal.format(value / 10_000), '만'),
      item(label.buff50, stats.buff50, (value) => fixedOneDecimal.format(value / 10_000), '만'),
      item('스위칭', stats.switchingLevel, (value) => integer.format(value), 'Lv')
    ]
  }
  const dealer = stats?.role === 'dealer' ? stats : null

  return [
    attackIncreaseItem(dealer?.attackIncrease ?? null),
    item(label.amplification, dealer?.amplification ?? null, (value) => integer.format(value), '%'),
    item('크리티컬', dealer?.critical ?? null, (value) => oneDecimal.format(value), '%'),
    item('스위칭', dealer?.switchingLevel ?? null, (value) => integer.format(value), 'Lv')
  ]
}
