import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, space } from './tokens.stylex'

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
    lineHeight: 1,
    whiteSpace: 'nowrap'
  },
  sm: {
    gap: 6,
    height: 24,
    paddingInline: space.s8,
    borderRadius: radius.control,
    fontWeight: 600
  },
  // 상단 바의 게임 연결 상태. 현재 위치를 보이는 칩이라 오른쪽 위를 잘라 낸다(shapes.cutTopRight와 함께).
  md: {
    gap: space.s8,
    height: 28,
    paddingInlineStart: 10,
    paddingInlineEnd: 14,
    borderRadius: 0,
    fontWeight: 700
  },
  neutral: { color: colors.fgMuted, backgroundColor: colors.bgControl },
  success: { color: colors.fgSuccess, backgroundColor: colors.bgSuccessWeak },
  danger: { color: colors.fgDanger, backgroundColor: colors.bgDangerWeak },
  // 주의 상태는 따로 색과 면을 두지 않고 중립색 글자와 모래시계 모양으로 구분한다.
  waiting: { color: colors.fgSubtle, backgroundColor: 'transparent' },
  dot: { flexShrink: 0, width: 6, height: 6, backgroundColor: 'currentColor' },
  liveDot: {
    animationName: { default: live, '@media (prefers-reduced-motion: reduce)': 'none' },
    animationDuration: `calc(${motion.beat} * 2)`,
    animationTimingFunction: 'steps(1, end)',
    animationIterationCount: 'infinite'
  },
  icon: { flexShrink: 0, width: 12, height: 12 }
})
