import * as stylex from '@stylexjs/stylex'
import { colors, font } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  heading: {
    flexShrink: 0,
    margin: 0,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: '14px',
    color: colors.fgDefault
  },
  number: {
    flexShrink: 0,
    color: colors.fgDefault,
    fontFamily: font.num,
    fontSize: 16,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1
  },
  round: { color: colors.signal },
  total: { color: colors.fgSubtle }
})
