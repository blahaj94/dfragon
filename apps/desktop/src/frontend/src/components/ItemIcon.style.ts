import * as stylex from '@stylexjs/stylex'
import { colors, motion } from '@dfragon/ui/tokens.stylex'

// 칸의 희귀도 색. 테두리, 아래 바, 아래에서 올라오는 옅은 면이 같은 색을 쓴다.
const RARITY = '--item-icon-rarity'
const rarity = `var(${RARITY})`
const frame = `inset 0 0 0 1px color-mix(in srgb, ${rarity} 45%, transparent), inset 0 -2px 0 ${rarity}`

// 태초 아이콘 칸을 주기마다 한 번 지나가는 빛줄기(캔버스 카드 면 보드). 주기의 30%까지 지나가고 나머지는 멈춘다.
const sweep = stylex.keyframes({
  '0%': { transform: 'translateX(-100%)' },
  '30%, 100%': { transform: 'translateX(100%)' }
})

// 캔버스 카드 면 보드의 아이콘 칸 24 × 24와 22 × 22 그림. 상세 창 보드의 칸은 28 × 28에 같은 크기 그림이다.
export const styles = stylex.create({
  cell: {
    position: 'relative',
    display: 'inline-grid',
    placeItems: 'center',
    flexShrink: 0,
    width: 24,
    height: 24,
    overflow: 'hidden',
    backgroundColor: colors.bgWell,
    backgroundImage: `linear-gradient(to top, color-mix(in srgb, ${rarity} 35%, transparent), transparent 70%)`,
    boxShadow: frame
  },
  cellLarge: { width: 28, height: 28 },
  // 태초는 은은한 빛과 빛줄기를 더한다. 동작 줄이기 설정에서는 빛줄기를 그리지 않는다.
  shine: {
    boxShadow: `0 0 6px color-mix(in srgb, ${rarity} 70%, transparent), ${frame}`,
    '::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      backgroundImage: `linear-gradient(90deg, transparent, color-mix(in srgb, ${colors.rarityCommon} 55%, transparent), transparent)`,
      transform: 'translateX(-100%)',
      opacity: { default: 1, '@media (prefers-reduced-motion: reduce)': 0 },
      animationName: { default: sweep, '@media (prefers-reduced-motion: reduce)': 'none' },
      animationDuration: motion.cycle,
      animationTimingFunction: motion.ease,
      animationIterationCount: 'infinite'
    }
  },
  image: { display: 'block', imageRendering: 'pixelated' }
})

// 희귀도 색 토큰 키별 칸 색. 장착 정보가 없으면 희귀도 면 없이 카드 테두리 색 1px 칸만 남긴다.
export const toneStyles = stylex.create({
  common: { [RARITY]: colors.rarityCommon },
  uncommon: { [RARITY]: colors.rarityUncommon },
  rare: { [RARITY]: colors.rarityRare },
  unique: { [RARITY]: colors.rarityUnique },
  epic: { [RARITY]: colors.rarityEpic },
  legendary: { [RARITY]: colors.rarityLegendary },
  chronicle: { [RARITY]: colors.rarityChronicle },
  primordial: { [RARITY]: colors.rarityPrimordial },
  unknown: { [RARITY]: colors.cardFg },
  missing: {
    [RARITY]: colors.cardBorder,
    backgroundImage: 'none',
    boxShadow: `inset 0 0 0 1px ${colors.cardBorder}`
  }
})
