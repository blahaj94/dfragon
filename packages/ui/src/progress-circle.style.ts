import * as stylex from '@stylexjs/stylex'
import { colors, motion } from './tokens.stylex'

// 한 박자에 여덟 칸씩 끊어 돈다. 부드러운 회전 대신 steps()로 기계적으로 움직인다.
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
  // 카드 위 어두운 덮개에 올리는 표시. 카드 글자색은 두 모드에서 같은 밝은 값이다.
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
