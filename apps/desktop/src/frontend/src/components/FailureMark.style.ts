import * as stylex from '@stylexjs/stylex'
import { colors, font } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  mark: {
    display: 'inline-grid',
    placeItems: 'center',
    flexShrink: 0,
    width: 20,
    height: 20,
    backgroundColor: colors.cardFailureWeak,
    color: colors.cardFailure
  },
  party: {
    fontFamily: font.num,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    letterSpacing: 0,
    fontSize: 14,
    fontWeight: 700
  },
  raid: { fontSize: 12, lineHeight: '14px' }
})
