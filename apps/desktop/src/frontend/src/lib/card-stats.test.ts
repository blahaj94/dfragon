import { expect, it } from 'vitest'
import { toCardStatItems } from './card-stats'

it('딜러 스탯은 공격력 증가를 억% 두 자리, 증폭과 크리티컬을 %, 스위칭을 Lv로 보인다', () => {
  expect(
    toCardStatItems({
      role: 'dealer',
      attackIncrease: 128_000_000,
      amplification: 2945,
      critical: 97.5,
      switchingLevel: 20
    })
  ).toEqual([
    { label: '공격력 증가', value: '1.28', unit: '억%' },
    { label: '증폭', value: '2,945', unit: '%' },
    { label: '크리티컬', value: '97.5', unit: '%' },
    { label: '스위칭', value: '20', unit: 'Lv' }
  ])
})

it('버퍼 스탯은 마을 지능을 단위 없이, 30레벨과 50레벨 버프 수치를 만 단위 한 자리로 보인다', () => {
  expect(
    toCardStatItems({
      role: 'buffer',
      townIntelligence: 31_420,
      buff30: 1_284_000,
      buff50: 3_926_000,
      switchingLevel: 18
    })
  ).toEqual([
    { label: '마을 지능', value: '31,420', unit: '' },
    { label: '30레벨', value: '128.4', unit: '만' },
    { label: '50레벨', value: '392.6', unit: '만' },
    { label: '스위칭', value: '18', unit: 'Lv' }
  ])
})

it('모르는 값은 0으로 바꾸지 않고 단위 없는 -로, 스탯이 없으면 딜러 라벨 네 칸을 모두 -로 둔다', () => {
  expect(
    toCardStatItems({
      role: 'buffer',
      townIntelligence: 0,
      buff30: null,
      buff50: 3_926_000,
      switchingLevel: null
    }).map(({ value, unit }) => `${value}${unit}`)
  ).toEqual(['0', '-', '392.6만', '-'])
  for (const stats of [null, undefined]) {
    expect(toCardStatItems(stats)).toEqual([
      { label: '공격력 증가', value: '-', unit: '' },
      { label: '증폭', value: '-', unit: '' },
      { label: '크리티컬', value: '-', unit: '' },
      { label: '스위칭', value: '-', unit: '' }
    ])
  }
})
