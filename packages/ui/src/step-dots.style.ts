import * as stylex from '@stylexjs/stylex'
import { motion } from './tokens.stylex'

// 한 박자(motion.beat)의 앞 1/3 동안만 켜지는 점. 세 점이 0.15초씩 늦게 시작해 차례로 켜진다.
const blip = stylex.keyframes({
  '0%': { opacity: 1 },
  '33%': { opacity: 0.25 }
})

export const styles = stylex.create({
  root: { display: 'inline-flex', flexShrink: 0 },
  // DFragon 디자인 캔버스의 캡처 보드 값이다. 상태 칩 안은 4px 점 3px 간격, 목록 안내는 5px 점 4px 간격이다.
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
