import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  field: {
    boxSizing: 'border-box',
    flex: '1 1 0',
    minWidth: 0,
    height: 14,
    margin: 0,
    padding: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomStyle: { default: 'dashed', ':focus': 'solid' },
    borderBottomColor: { default: colors.cardBorderStrong, ':focus': colors.cardSignal },
    backgroundColor: 'transparent',
    color: colors.cardFgAdventure,
    fontFamily: 'inherit',
    fontSize: 12,
    lineHeight: '14px',
    outlineStyle: 'none',
    '::placeholder': { color: colors.cardBorderStrong }
  }
})
