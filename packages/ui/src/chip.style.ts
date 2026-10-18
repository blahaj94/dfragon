import * as stylex from '@stylexjs/stylex'
import { colors, radius, space } from './tokens.stylex'

export const styles = stylex.create({
  // 눌린 칩은 신호색 면이 된다. 선택에만 신호색을 쓴다.
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.s4,
    height: 24,
    margin: 0,
    paddingInline: space.s8,
    borderWidth: 0,
    borderRadius: radius.control,
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    color: {
      default: colors.fgDefault,
      ':is([data-pressed])': colors.onSignal,
      ':disabled': colors.fgDisabled
    },
    backgroundColor: {
      default: colors.bgControl,
      ':hover:not(:disabled)': colors.bgControlHover,
      ':is([data-pressed])': colors.signal
    }
  }
})
