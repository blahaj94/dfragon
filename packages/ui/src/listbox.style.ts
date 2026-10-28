import * as stylex from '@stylexjs/stylex'
import { colors, motion, shape, space } from './tokens.stylex'

const cut = shape.cut
const openShape = `polygon(0 0, 100% 0, 100% calc(100% - ${cut}), calc(100% - ${cut}) 100%, 0 100%)`
const foldedShape = 'polygon(0 0, 100% 0, 100% 0, 100% 0, 0 0)'

export const listboxStyles = stylex.create({
  positioner: { zIndex: 110, outlineStyle: 'none' },
  popup: {
    boxSizing: 'border-box',
    minWidth: 'max(112px, var(--anchor-width))',
    maxHeight: 'var(--available-height)',
    paddingBlock: space.s4,
    overflowY: 'auto',
    borderTopWidth: 2,
    borderTopStyle: 'solid',
    borderTopColor: colors.signal,
    backgroundColor: colors.bgInset,
    boxShadow: `inset 0 0 0 1px ${colors.borderStrong}`,
    color: colors.fgMuted,
    outlineStyle: 'none',
    clipPath: {
      default: openShape,
      ':is([data-starting-style], [data-ending-style])': foldedShape
    },
    transitionProperty: 'clip-path',
    transitionDuration: motion.durState,
    transitionTimingFunction: motion.ease
  },
  item: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: space.s8,
    paddingInline: space.s12,
    outlineStyle: 'none',
    cursor: { default: 'pointer', ':is([data-disabled])': 'not-allowed' },
    userSelect: 'none',
    color: {
      default: 'inherit',
      ':is([data-highlighted])': colors.fgDefault,
      ':is([data-selected], [data-checked])': colors.signal,
      ':is([data-disabled])': colors.fgDisabled
    },
    fontWeight: { default: 'inherit', ':is([data-selected], [data-checked])': 700 },
    backgroundColor: { default: 'transparent', ':is([data-highlighted])': colors.bgControlHover },
    transitionProperty: 'color, background-color',
    transitionDuration: motion.durHover,
    transitionTimingFunction: motion.ease
  },
  marker: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 0,
    width: 2,
    backgroundColor: colors.signal
  },
  groupLabel: {
    paddingInline: space.s12,
    paddingBlock: space.s4,
    fontSize: 12,
    lineHeight: '18px',
    fontWeight: 600,
    color: colors.fgSubtle
  },
  separator: {
    height: 1,
    marginBlock: space.s4,
    backgroundColor: colors.borderDefault
  },
  cardPopup: {
    borderTopColor: colors.cardSignal,
    backgroundColor: colors.cardInset,
    boxShadow: `inset 0 0 0 1px ${colors.cardBorderStrong}`,
    color: colors.cardFgMuted
  },
  cardItem: {
    color: {
      default: 'inherit',
      ':is([data-highlighted])': colors.cardFg,
      ':is([data-selected], [data-checked])': colors.cardSignal,
      ':is([data-disabled])': colors.cardBorderStrong
    },
    backgroundColor: { default: 'transparent', ':is([data-highlighted])': colors.cardControlHover }
  },
  cardMarker: { backgroundColor: colors.cardSignal },
  cardGroupLabel: { color: colors.cardFgSubtle },
  cardSeparator: { backgroundColor: colors.cardBorder }
})
