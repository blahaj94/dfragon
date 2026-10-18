import * as stylex from '@stylexjs/stylex'
import { colors, font, radius, size, space } from './tokens.stylex'

export const styles = stylex.create({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    minWidth: size.controlSm,
    height: size.controlSm,
    paddingInline: space.s8,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    color: colors.fgDefault,
    fontFamily: font.num,
    fontSize: 20,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1
  }
})
