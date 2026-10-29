import { expect, it } from 'vitest'
import { gradeRarity } from './today-grade'

it.each([
  [0, 'common'],
  [49, 'common'],
  [50, 'uncommon'],
  [85, 'uncommon'],
  [89, 'uncommon'],
  [90, 'epic'],
  [95, 'epic'],
  [96, 'primordial'],
  [100, 'primordial']
] as const)('등급 %i퍼센트는 %s다', (percent, rarity) => {
  expect(gradeRarity(percent)).toBe(rarity)
})
