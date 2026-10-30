import * as stylex from '@stylexjs/stylex'
import { siteColors, siteFonts } from '../theme.stylex'

export const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingInline: 22,
    backgroundColor: { default: siteColors.accent, ':hover': siteColors.accentHover },
    color: siteColors.onAccent,
    boxShadow: `4px 4px 0 ${siteColors.ink}`,
    fontFamily: siteFonts.body,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: '22px',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    outline: { default: null, ':focus-visible': `3px solid ${siteColors.ink}` },
    outlineOffset: 2
  },
  meta: {
    margin: 0,
    fontSize: 14,
    lineHeight: '22px',
    color: siteColors.inkMuted
  },
  number: {
    fontFamily: siteFonts.number,
    fontSize: 16,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  }
})
