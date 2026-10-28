import * as stylex from '@stylexjs/stylex'
import { colors, font } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  root: {
    display: 'flex',
    alignItems: 'center',
    height: 28,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    fontSize: 12,
    lineHeight: '14px'
  },
  label: { marginInlineEnd: 6, color: colors.fgSubtle },
  value: { color: colors.fgMuted },
  number: {
    fontFamily: font.num,
    fontSize: 14,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  }
})
