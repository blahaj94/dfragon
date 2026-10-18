import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from './tokens.stylex'

export const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 24,
    paddingInline: space.s8,
    borderRadius: radius.control,
    backgroundColor: colors.bgControl,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap'
  },
  neutral: { color: colors.fgMuted },
  success: { color: colors.fgSuccess },
  danger: { color: colors.fgDanger },
  // 주의 상태는 따로 색을 두지 않고 중립색과 모래시계 모양으로 구분한다.
  waiting: { color: colors.fgMuted },
  dot: { flexShrink: 0, width: 6, height: 6, backgroundColor: 'currentColor' },
  icon: { flexShrink: 0, width: 12, height: 12 }
})
