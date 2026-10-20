// Shared with Desktop SelectedCharacterSummary.card (blahaj94/dfragon#716). Unknown values stay null.
export type CharacterRole = 'dealer' | 'buffer'

export interface CharacterDealerStats {
  role: 'dealer'
  attackIncrease: number | null
  amplification: number | null
  critical: number | null
  switchingLevel: number | null
}

// The buffer's main stat: 정신력 for 뮤즈 and 패러메딕, the larger of 정신력 and 체력 for male 크루세이더, else 지능.
export type CharacterTownStatName = '지능' | '정신력' | '체력'

export interface CharacterBufferStats {
  role: 'buffer'
  townStatName: CharacterTownStatName
  townStat: number | null
  buff30: number | null
  buff50: number | null
  switchingLevel: number | null
}

export interface CharacterScore {
  calculator: 'equipment' | 'buff'
  value: number | null
  skipped: { kind: string; message: string } | null
  versions: { package: string; rulesRev: string; bundleId: string }
}

export interface CharacterServerRank {
  rank: number
  total: number
  basis: 'fame'
  scope: 'stored'
  observedAt: string
}

export interface CharacterSetPoint {
  current: number
  min: number
  max: number
}

export interface CharacterRarityCount {
  rarity: string
  count: number
}

export interface CharacterSetCard {
  setItemId: string
  name: string
  rarityName: string | null
  point: CharacterSetPoint | null
  imageItemId: string | null
  // exclusive marks 유일 장비 slots; rarityCounts counts them as '유일' instead of their rarity.
  slots: { slotId: string; rarity: string | null; exclusive: boolean }[]
  rarityCounts: CharacterRarityCount[]
}

export interface CharacterOathCard {
  itemId: string
  name: string
  rarity: string | null
  point: number | null
  setName: string | null
  optionName: string | null
  setPoint: CharacterSetPoint | null
  upgrades: { step: number; stepName: string; optionName: string }[]
  crystals: {
    slotNo: number
    itemId: string
    name: string
    rarity: string | null
    setPoint: number | null
  }[]
  rarityCounts: CharacterRarityCount[]
}

export type EnchantGrade = '종결' | '준종결' | '기타'

export interface EnchantStatus {
  name: string
  value: number | string
}

export interface CharacterInvestment {
  slotId: string
  slotName: string
  itemId: string | null
  itemName: string | null
  rarity: string | null
  // 유일 장비 from the repository table; false for an empty slot.
  exclusive: boolean
  reinforce: {
    kind: 'reinforce' | 'amplify'
    value: number
    amplificationName: string | null
  } | null
  enchant: { status: EnchantStatus[]; grade: EnchantGrade | null } | null
}

export interface CharacterCard {
  role: CharacterRole | null
  stats: CharacterDealerStats | CharacterBufferStats | null
  // Desktop main fills the score from the native engine; the API never calculates it.
  score: CharacterScore | null
  serverRank: CharacterServerRank | null
  set: CharacterSetCard | null
  oath: CharacterOathCard | null
  investment: CharacterInvestment[]
}
