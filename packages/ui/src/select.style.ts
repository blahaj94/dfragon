import * as stylex from '@stylexjs/stylex'
import { colors, motion, radius, size, space } from './tokens.stylex'

export const styles = stylex.create({
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.s4,
    minWidth: 0,
    margin: 0,
    paddingInlineStart: space.s8,
    paddingInlineEnd: 6,
    borderWidth: 0,
    borderRadius: radius.control,
    fontFamily: 'inherit',
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: { default: 'pointer', ':disabled': 'not-allowed' },
    color: {
      default: colors.fgDefault,
      ':is([data-popup-open])': colors.onSignal,
      ':disabled': colors.fgDisabled
    },
    backgroundColor: {
      default: colors.bgControl,
      ':hover:not(:disabled, [data-popup-open])': colors.bgControlHover,
      ':is([data-popup-open])': colors.signal
    }
  },
  '2xs': { height: 16, fontSize: 12, paddingInlineStart: 6, paddingInlineEnd: space.s4 },
  xs: { height: 24, fontSize: 12 },
  sm: { height: size.controlSm, fontSize: 13 },
  md: { height: size.controlMd, fontSize: 14 },
  value: { overflow: 'hidden', textOverflow: 'ellipsis' },
  placeholder: { color: colors.fgPlaceholder },
  icon: {
    display: 'inline-flex',
    flexShrink: 0,
    fontSize: 14,
    transform: { default: 'none', ':is([data-popup-open])': 'scaleY(-1)' },
    transitionProperty: 'transform',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  item: { height: 28, fontSize: 13 },
  grid: (columns: number) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, auto)`
  }),
  cardTrigger: {
    color: {
      default: colors.cardFg,
      ':is([data-popup-open])': colors.cardOnSignal,
      ':disabled': colors.cardFgSubtle
    },
    backgroundColor: {
      default: colors.cardControl,
      ':hover:not(:disabled, [data-popup-open])': colors.cardControlHover,
      ':is([data-popup-open])': colors.cardSignal
    },
    outlineColor: colors.cardSignal
  }
})
