import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from './tokens.stylex'

const live = stylex.keyframes({
  '0%': { opacity: 1 },
  '50%': { opacity: 0.35 }
})

export const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: 'nowrap'
  },
  sm: { gap: 7, height: 24, paddingInlineStart: 9, paddingInlineEnd: space.s12 },
  md: { gap: space.s8, height: 28, paddingInlineStart: 10, paddingInlineEnd: 14 },
  neutral: {
    color: colors.fgSubtle,
    backgroundColor: `color-mix(in srgb, ${colors.fgSubtle} 12%, transparent)`
  },
  success: { color: colors.fgSuccess, backgroundColor: colors.bgSuccessWeak },
  danger: { color: colors.fgDanger, backgroundColor: colors.bgDangerWeak },
  warning: { color: colors.fgWarning, backgroundColor: colors.bgWarningWeak },
  signal: {
    color: colors.signal,
    backgroundColor: `color-mix(in srgb, ${colors.signal} 12%, transparent)`
  },
  dot: { flexShrink: 0, width: 6, height: 6, backgroundColor: 'currentColor' },
  liveDot: {
    animationName: { default: live, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: `calc(${motion.beat} * 2)`,
    animationTimingFunction: 'steps(1, end)',
    animationIterationCount: 'infinite'
  }
})
