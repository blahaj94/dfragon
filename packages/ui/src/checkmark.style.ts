import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius } from './tokens.stylex'

// 상태 속성은 Checkmark를 감싼 checkbox root(바로 위 부모)가 갖는다.
const CHECKED = ':is([data-checked] > *)'
const DISABLED = ':is([data-disabled] > *)'
const CHECKED_ICON = ':is([data-checked] > * > *)'

export const styles = stylex.create({
  box: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
    width: 18,
    height: 18,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: radius.control,
    color: colors.onSignal,
    borderColor: {
      default: colors.borderStrong,
      [CHECKED]: colors.signal,
      [DISABLED]: colors.borderDefault
    },
    backgroundColor: {
      default: colors.bgInset,
      [CHECKED]: colors.signal,
      [DISABLED]: colors.bgControl
    },
    transitionProperty: 'background-color, border-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  check: {
    display: 'inline-flex',
    fontSize: 14,
    visibility: { default: 'hidden', [CHECKED_ICON]: 'visible' }
  }
})
