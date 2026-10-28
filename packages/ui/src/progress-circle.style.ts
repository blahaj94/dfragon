import * as stylex from '@stylexjs/stylex'
import { colors, motion } from './tokens.stylex'

const turn = stylex.keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' }
})

export const styles = stylex.create({
  root: { display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' },
  size24: { width: 24, height: 24 },
  size40: { width: 40, height: 40 },
  sizeInherit: { width: '1em', height: '1em' },
  neutral: { color: colors.fgMuted },
  brand: { color: colors.signal },
  staticWhite: { color: colors.cardFg },
  inherit: { color: 'currentColor' },
  track: { stroke: colors.borderDefault },
  range: { stroke: 'currentColor' },
  spinning: {
    transformOrigin: 'center',
    animationName: { default: turn, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: motion.beat,
    animationTimingFunction: 'steps(8, end)',
    animationIterationCount: 'infinite'
  }
})
