import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from './tokens.stylex'

export const styles = stylex.create({
  list: {
    position: 'relative',
    display: 'flex',
    alignItems: 'stretch',
    gap: space.s4,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.borderDefault
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 36,
    margin: 0,
    paddingInline: space.s16,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    cursor: { default: 'pointer', ':is([data-disabled])': 'not-allowed' },
    color: {
      default: colors.fgSubtle,
      ':hover': colors.fgDefault,
      ':is([data-active])': colors.fgDefault,
      ':is([data-disabled])': colors.fgDisabled
    }
  },
  // 현재 탭 아래의 2px 신호색 선. 탭을 바꾸면 hover와 같은 시간에 옮겨 간다.
  indicator: {
    position: 'absolute',
    bottom: -1,
    left: 'var(--active-tab-left)',
    width: 'var(--active-tab-width)',
    height: 2,
    backgroundColor: colors.signal,
    transitionProperty: 'left, width',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  }
})
