import * as stylex from '@stylexjs/stylex'
import { colors, motion } from './tokens.stylex'

const sweep = stylex.keyframes({
  '0%, 6%': { transform: 'translateX(-120%)' },
  '30%, 100%': { transform: 'translateX(260%)' }
})

const topBand = `color-mix(in srgb, ${colors.tierTop} 8%, transparent)`
const rankerBand = `color-mix(in srgb, ${colors.tierRanker} 16%, transparent)`

export const styles = stylex.create({
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    margin: 0,
    backgroundColor: colors.cardBg,
    color: colors.cardFg,
    transitionProperty: 'background-color, outline-color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  waiting: {
    backgroundColor: colors.cardBgWaiting,
    outlineWidth: 1,
    outlineStyle: 'dashed',
    outlineColor: colors.cardBorder,
    outlineOffset: -1
  },
  ranker: {
    backgroundColor: colors.tierRankerSurface,
    outlineWidth: 1,
    outlineStyle: 'solid',
    outlineColor: colors.tierRankerOutline,
    outlineOffset: -1
  },
  // 빛줄기와 스캔선을 담는 층. 꺾쇠가 카드 밖으로 1px 나오므로 카드 대신 이 층이 빛줄기를 자른다.
  effects: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none'
  },
  sweep: {
    display: { default: 'block', '@media (prefers-reduced-motion: reduce)': 'none' },
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    transform: 'translateX(-120%)',
    animationName: { default: sweep, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: motion.cycle,
    animationTimingFunction: motion.ease,
    animationIterationCount: 'infinite'
  },
  sweepTop: {
    width: '50%',
    backgroundImage: `linear-gradient(100deg, transparent 0, ${topBand} 45%, ${topBand} 55%, transparent 100%)`
  },
  sweepRanker: {
    width: '60%',
    backgroundImage: `linear-gradient(100deg, transparent 0, ${rankerBand} 45%, ${rankerBand} 55%, transparent 100%)`
  }
})
