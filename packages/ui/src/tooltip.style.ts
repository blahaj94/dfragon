import * as stylex from '@stylexjs/stylex'
import { colors, motion, space } from './tokens.stylex'

export const styles = stylex.create({
  positioner: { zIndex: 120 },
  popup: {
    paddingBlock: space.s4,
    paddingInline: space.s8,
    backgroundColor: colors.bgInset,
    boxShadow: `inset 0 0 0 1px ${colors.borderStrong}`,
    color: colors.fgDefault,
    fontSize: 12,
    lineHeight: '18px',
    opacity: { default: 1, ':is([data-starting-style], [data-ending-style])': 0 },
    transitionProperty: 'opacity',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  }
})
