import * as stylex from '@stylexjs/stylex'
import { colors, motion } from './tokens.stylex'

// 누를 수 있는 공용 Component가 함께 쓰는 포커스 표시와 전환 시간.
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
