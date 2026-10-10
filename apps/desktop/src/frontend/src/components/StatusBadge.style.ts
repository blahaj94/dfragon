import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  // SEED large Badge가 높이 24를 유지한다. 상태 글자가 말줄임으로 잘리지 않도록 폭 제한을 푼다.
  badge: {
    maxWidth: 'none',
    borderRadius: 999,
    backgroundColor: colors.bgInset
  },
  neutral: { color: colors.fgSubtle },
  informative: { color: colors.fgInfo },
  critical: { color: colors.fgDanger },
  warning: { color: colors.fgWarning },
  positive: { color: colors.fgSuccess },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    marginInlineEnd: 6,
    verticalAlign: 'middle',
    borderRadius: '50%',
    backgroundColor: 'currentColor'
  }
})
