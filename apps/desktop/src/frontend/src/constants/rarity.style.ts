import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

// 카드 면이 희귀도 색 토큰 키(lib/card-faces의 RarityTone)로 고르는 글자색과 면 색. 모르는 희귀도는 카드 글자색이다.
export const rarityText = stylex.create({
  common: { color: colors.rarityCommon },
  uncommon: { color: colors.rarityUncommon },
  rare: { color: colors.rarityRare },
  unique: { color: colors.rarityUnique },
  epic: { color: colors.rarityEpic },
  legendary: { color: colors.rarityLegendary },
  chronicle: { color: colors.rarityChronicle },
  primordial: { color: colors.rarityPrimordial },
  unknown: { color: colors.cardFg }
})

export const rarityFill = stylex.create({
  common: { backgroundColor: colors.rarityCommon },
  uncommon: { backgroundColor: colors.rarityUncommon },
  rare: { backgroundColor: colors.rarityRare },
  unique: { backgroundColor: colors.rarityUnique },
  epic: { backgroundColor: colors.rarityEpic },
  legendary: { backgroundColor: colors.rarityLegendary },
  chronicle: { backgroundColor: colors.rarityChronicle },
  primordial: { backgroundColor: colors.rarityPrimordial },
  unknown: { backgroundColor: colors.cardFg }
})
