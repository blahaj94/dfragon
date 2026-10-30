import * as stylex from '@stylexjs/stylex'
import { colors, motion } from '@dfragon/ui/tokens.stylex'

const blink = stylex.keyframes({
  '0%': { opacity: 1 },
  '50%': { opacity: 0.25 }
})

export const styles = stylex.create({
  progress: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' },
  // 상세 정보를 받는 동안은 초상화 위에 놓이므로 점 뒤에 그림 칸 면을 깔아 대비를 지킨다.
  dots: { display: 'flex', backgroundColor: colors.bgWell },
  party: { gap: 4, padding: 4 },
  raid: { gap: 3, padding: 3 },
  dot: { flexShrink: 0, backgroundColor: colors.borderStrong },
  partyDot: { width: 5, height: 5 },
  raidDot: { width: 4, height: 4 },
  done: { backgroundColor: colors.signal },
  active: {
    animationName: { default: blink, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: motion.beat,
    animationTimingFunction: 'steps(1, end)',
    animationIterationCount: 'infinite'
  }
})
