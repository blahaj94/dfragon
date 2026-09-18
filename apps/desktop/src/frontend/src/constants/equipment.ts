// Explicit visual positions; equipment arrays may arrive in any order.
export const equipmentPositions = [
  ['SHOULDER', 1, 1],
  ['JACKET', 2, 1],
  ['PANTS', 1, 2],
  ['WAIST', 2, 2],
  ['SHOES', 1, 3],
  ['AURA', 1, 4],
  ['CREATURE', 2, 4],
  ['WEAPON', 3, 1],
  ['TITLE', 4, 1],
  ['WRIST', 3, 2],
  ['AMULET', 4, 2],
  ['SUPPORT', 3, 3],
  ['RING', 4, 3],
  ['EARRING', 3, 4],
  ['MAGIC_STON', 4, 4]
] as const

export const investmentIds = [
  'WEAPON',
  'JACKET',
  'SHOULDER',
  'PANTS',
  'WAIST',
  'SHOES',
  'AMULET',
  'WRIST',
  'RING',
  'SUPPORT',
  'MAGIC_STON',
  'EARRING'
]

export const investmentAriaLabelByKind = {
  enhancement: '강화 수치',
  enchantment: '마법부여 등급',
  both: '투자 현황'
} as const
