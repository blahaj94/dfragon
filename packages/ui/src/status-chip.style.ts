import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from './tokens.stylex'

// 게임 연결됨: 사각 점이 motion.beat 두 번 주기로 끊어서 깜박인다.
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
  // DFragon 디자인 캔버스의 캡처 대화상자 머리 칩이다.
  sm: { gap: 7, height: 24, paddingInlineStart: 9, paddingInlineEnd: space.s12 },
  // 상단 바의 게임 연결 상태.
  md: { gap: space.s8, height: 28, paddingInlineStart: 10, paddingInlineEnd: 14 },
  // 옅은 면은 글자색의 12%다. 성공, 주의 톤은 같은 비율의 토큰을 쓴다.
  // 준비 중, 창 확인 중처럼 아직 판단하지 않은 상태.
  neutral: {
    color: colors.fgSubtle,
    backgroundColor: `color-mix(in srgb, ${colors.fgSubtle} 12%, transparent)`
  },
  success: { color: colors.fgSuccess, backgroundColor: colors.bgSuccessWeak },
  danger: { color: colors.fgDanger, backgroundColor: colors.bgDangerWeak },
  // 확인 필요, 창 미감지처럼 사용자가 살펴야 하는 상태.
  warning: { color: colors.fgWarning, backgroundColor: colors.bgWarningWeak },
  // 인식 중, 인식 완료처럼 지금 진행하는 캡처 회차.
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
