import * as stylex from '@stylexjs/stylex'
import { colors, motion } from './tokens.stylex'

// 상위: 한 주기 동안 꺾쇠가 밝아졌다 흐려진다.
const breathe = stylex.keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.45 }
})

// 랭커: 주기가 시작될 때(주기의 8%) 꺾쇠가 바깥 10px에서 제자리로 조여 든다.
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
  danger: { borderColor: colors.bracketDanger },
  top: { borderColor: colors.bracketTop },
  ranker: { borderColor: colors.bracketRanker },
  // 반복 효과는 motion.cycle 한 주기에 묶고, 동작 줄이기 설정에서는 멈춘다.
  cycle: {
    animationDuration: motion.cycle,
    animationIterationCount: 'infinite'
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
