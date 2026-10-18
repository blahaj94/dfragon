import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius } from './tokens.stylex'

export const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
    width: 18,
    height: 18,
    padding: 0,
    margin: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: radius.control,
    cursor: { default: 'pointer', ':is([data-disabled])': 'not-allowed' },
    color: colors.onSignal,
    borderColor: {
      default: colors.borderStrong,
      ':is([data-checked], [data-indeterminate])': colors.signal,
      ':is([data-disabled])': colors.borderDefault
    },
    backgroundColor: {
      default: colors.bgInset,
      ':is([data-checked], [data-indeterminate])': colors.signal,
      ':is([data-disabled])': colors.bgControl
    },
    transitionProperty: 'background-color, border-color',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  indicator: { display: 'inline-flex', fontSize: 14 }
})
