import * as stylex from '@stylexjs/stylex'
import { colors, motion, size, space } from './tokens.stylex'

const onCard = ':is([data-surface="card"])'

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
    flex: { default: null, [stylex.when.ancestor(onCard)]: '1 1 0' },
    minWidth: { default: null, [stylex.when.ancestor(onCard)]: 0 },
    alignItems: 'center',
    justifyContent: { default: null, [stylex.when.ancestor(onCard)]: 'center' },
    gap: 6,
    height: { default: 36, [stylex.when.ancestor(onCard)]: size.controlMd },
    margin: 0,
    paddingInline: { default: space.s16, [stylex.when.ancestor(onCard)]: space.s4 },
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    fontSize: { default: 14, [stylex.when.ancestor(onCard)]: 13 },
    fontWeight: 600,
    whiteSpace: 'nowrap',
    cursor: { default: 'pointer', ':is([data-disabled])': 'not-allowed' },
    color: {
      default: colors.fgSubtle,
      [stylex.when.ancestor(onCard)]: colors.cardFgSubtle,
      ':hover': { default: colors.fgDefault, [stylex.when.ancestor(onCard)]: colors.cardFg },
      ':is([data-active])': {
        default: colors.fgDefault,
        [stylex.when.ancestor(onCard)]: colors.cardFg
      },
      ':is([data-disabled])': {
        default: colors.fgDisabled,
        [stylex.when.ancestor(onCard)]: colors.cardBorderStrong
      }
    }
  },
  // controlStyles.focusRing 뒤에 합쳐 카드 면 탭만 포커스 링 색과 위치를 바꾼다.
  // 카드 바깥과 옆 탭으로 넘치지 않게 카드 면에서는 링을 탭 안쪽에 그린다.
  focusRing: {
    outlineColor: { default: colors.signal, [stylex.when.ancestor(onCard)]: colors.cardSignal },
    outlineOffset: { default: 2, [stylex.when.ancestor(onCard)]: -2 }
  },
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
  cardList: {
    gap: 0,
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.cardBorder
  },
  cardIndicator: { top: -1, bottom: 'auto', backgroundColor: colors.cardSignal }
})
