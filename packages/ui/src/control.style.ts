import * as stylex from '@stylexjs/stylex'
import { colors, motion } from './tokens.stylex'

export const controlStyles = stylex.create({
  focusRing: {
    outlineStyle: { default: 'none', ':focus-visible': 'solid' },
    outlineWidth: 2,
    outlineColor: colors.signal,
    outlineOffset: 2
  },
  hoverTransition: {
    transitionProperty: 'color, background-color, border-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  }
})
