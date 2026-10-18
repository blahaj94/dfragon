import * as stylex from '@stylexjs/stylex'
import { colors, motion, size, space } from './tokens.stylex'

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
  },
  // 카드 면 탭. 카드 아래 높이 40 줄을 탭이 나눠 채우고 위쪽 1px 선 위에 현재 탭 선을 둔다.
  cardList: {
    gap: 0,
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardBorder
  },
  cardTab: {
    flex: '1 1 0',
    minWidth: 0,
    justifyContent: 'center',
    height: size.controlMd,
    paddingInline: space.s4,
    fontSize: 13,
    color: {
      default: colors.cardFgSubtle,
      ':hover': colors.cardFg,
      ':is([data-active])': colors.cardFg,
      ':is([data-disabled])': colors.cardBorderStrong
    },
    outlineColor: colors.cardSignal,
    // 카드 바깥과 옆 탭으로 넘치지 않게 포커스 선을 탭 안쪽에 그린다.
    outlineOffset: -2
  },
  cardIndicator: { top: -1, bottom: 'auto', backgroundColor: colors.cardSignal }
})
