import * as stylex from '@stylexjs/stylex'
import { colors, motion } from './tokens.stylex'

const breathe = stylex.keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.45 }
})

const lockTopLeft = stylex.keyframes({
  '0%': { transform: 'translate(-10px, -10px)', opacity: 0 },
  '8%, 100%': { transform: 'none', opacity: 1 }
})
const lockTopRight = stylex.keyframes({
  '0%': { transform: 'translate(10px, -10px)', opacity: 0 },
  '8%, 100%': { transform: 'none', opacity: 1 }
})
const lockBottomLeft = stylex.keyframes({
  '0%': { transform: 'translate(-10px, 10px)', opacity: 0 },
  '8%, 100%': { transform: 'none', opacity: 1 }
})
const lockBottomRight = stylex.keyframes({
  '0%': { transform: 'translate(10px, 10px)', opacity: 0 },
  '8%, 100%': { transform: 'none', opacity: 1 }
})

const pulseTopLeft = stylex.keyframes({
  '0%': { transform: 'translate(-4px, -4px)', opacity: 0.5 },
  '30%, 100%': { transform: 'none', opacity: 1 }
})
const pulseTopRight = stylex.keyframes({
  '0%': { transform: 'translate(4px, -4px)', opacity: 0.5 },
  '30%, 100%': { transform: 'none', opacity: 1 }
})
const pulseBottomLeft = stylex.keyframes({
  '0%': { transform: 'translate(-4px, 4px)', opacity: 0.5 },
  '30%, 100%': { transform: 'none', opacity: 1 }
})
const pulseBottomRight = stylex.keyframes({
  '0%': { transform: 'translate(4px, 4px)', opacity: 0.5 },
  '30%, 100%': { transform: 'none', opacity: 1 }
})

export const styles = stylex.create({
  corner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderStyle: 'solid',
    borderWidth: 0,
    pointerEvents: 'none',
    transitionProperty: 'border-color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  topLeft: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
  topRight: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
  bottomLeft: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
  bottomRight: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
  default: { borderColor: colors.bracketDefault },
  selected: { borderColor: colors.bracketSelected },
  failure: { borderColor: colors.bracketFailure },
  top: { borderColor: colors.bracketTop },
  ranker: { borderColor: colors.bracketRanker },
  cycle: {
    animationDuration: motion.cycle,
    animationIterationCount: 'infinite'
  },
  pulse: {
    animationDuration: `calc(${motion.beat} * 2)`,
    animationIterationCount: 'infinite',
    animationTimingFunction: motion.ease
  },
  pulseTopLeft: {
    animationName: { default: pulseTopLeft, '@media (prefers-reduced-motion: reduce)': 'none' }
  },
  pulseTopRight: {
    animationName: { default: pulseTopRight, '@media (prefers-reduced-motion: reduce)': 'none' }
  },
  pulseBottomLeft: {
    animationName: { default: pulseBottomLeft, '@media (prefers-reduced-motion: reduce)': 'none' }
  },
  pulseBottomRight: {
    animationName: {
      default: pulseBottomRight,
      '@media (prefers-reduced-motion: reduce)': 'none'
    }
  },
  breathe: {
    animationName: { default: breathe, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationTimingFunction: 'ease-in-out'
  },
  lockTopLeft: {
    animationName: { default: lockTopLeft, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationTimingFunction: motion.ease
  },
  lockTopRight: {
    animationName: { default: lockTopRight, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationTimingFunction: motion.ease
  },
  lockBottomLeft: {
    animationName: { default: lockBottomLeft, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationTimingFunction: motion.ease
  },
  lockBottomRight: {
    animationName: {
      default: lockBottomRight,
      '@media (prefers-reduced-motion: reduce)': 'none'
    },
    animationTimingFunction: motion.ease
  }
})
