import * as stylex from '@stylexjs/stylex'
import { motion } from './tokens.stylex'

const blip = stylex.keyframes({
  '0%': { opacity: 1 },
  '33%': { opacity: 0.25 }
})

export const styles = stylex.create({
  root: { display: 'inline-flex', flexShrink: 0 },
  size4: { gap: 3 },
  size5: { gap: 4 },
  dot: {
    backgroundColor: 'currentColor',
    opacity: { default: 0.25, '@media (prefers-reduced-motion: reduce)': 1 },
    animationName: { default: blip, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: motion.beat,
    animationTimingFunction: 'steps(1, end)',
    animationIterationCount: 'infinite'
  },
  dot4: { width: 4, height: 4 },
  dot5: { width: 5, height: 5 },
  second: { animationDelay: '0.15s' },
  third: { animationDelay: '0.3s' }
})
