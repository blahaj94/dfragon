import * as stylex from '@stylexjs/stylex'
import { colors, font, radius } from './tokens.stylex'

export const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    minWidth: 22,
    height: 22,
    paddingInline: 5,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    color: colors.fgDefault,
    fontFamily: font.num,
    fontSize: 14,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1
  },
  signal: {
    borderColor: 'color-mix(in srgb, currentColor 55%, transparent)',
    color: 'inherit'
  }
})
