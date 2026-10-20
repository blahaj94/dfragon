import * as stylex from '@stylexjs/stylex'
import { colors, motion } from '@dfragon/ui/tokens.stylex'

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

// 유일 장비 이름과 개수 숫자를 주기마다 한 번 지나가는 빛(캔버스 카드 면 보드). 주기의 30%까지 지나가고 멈춘다.
const textSweep = stylex.keyframes({
  '0%': { backgroundPosition: '100% 0' },
  '30%, 100%': { backgroundPosition: '0 0' }
})

/**
 * 유일 장비 글자. 태초와 같은 청록에 흰 빛이 지나가고, 동작 줄이기 설정에서는 빛을 멈춘다. 글자색은 투명하게 두고
 * 배경을 글자 모양으로 잘라 칠하므로 희귀도 글자색 대신 쓴다.
 */
export const exclusiveText = stylex.create({
  shine: {
    backgroundImage: `linear-gradient(100deg, ${colors.rarityPrimordial} 40%, ${colors.rarityCommon} 50%, ${colors.rarityPrimordial} 60%)`,
    backgroundSize: '300% 100%',
    backgroundPosition: '0 0',
    backgroundClip: 'text',
    color: 'transparent',
    textShadow: `0 0 8px color-mix(in srgb, ${colors.rarityPrimordial} 45%, transparent)`,
    animationName: { default: textSweep, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: motion.cycle,
    animationTimingFunction: motion.ease,
    animationIterationCount: 'infinite'
  }
})
