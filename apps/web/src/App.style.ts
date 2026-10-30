import * as stylex from '@stylexjs/stylex'
import { siteColors, siteFonts } from './theme.stylex'

const GUTTER = 'max(16px, calc((100% - 1280px) / 2))'
const focusRing = { default: null, ':focus-visible': `3px solid ${siteColors.ink}` }

export const styles = stylex.create({
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: siteColors.page,
    color: siteColors.ink
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    height: 64,
    flexShrink: 0,
    paddingInline: GUTTER,
    backgroundColor: siteColors.surface,
    borderBottom: `1px solid ${siteColors.line}`
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontFamily: siteFonts.title,
    fontSize: 24,
    fontWeight: 700,
    lineHeight: '36px',
    color: siteColors.ink,
    textDecoration: 'none',
    outline: focusRing,
    outlineOffset: 2
  },
  icon: {
    display: 'block',
    imageRendering: 'pixelated',
    outline: `2px solid ${siteColors.ink}`
  },
  nav: { marginInlineStart: 'auto' },
  navLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: '20px',
    color: { default: siteColors.inkMuted, ':hover': siteColors.ink },
    textDecoration: 'none',
    outline: focusRing,
    outlineOffset: 2
  },
  hero: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 24,
    minWidth: 0,
    minHeight: 720,
    boxSizing: 'border-box',
    paddingTop: 32,
    paddingBottom: 64,
    paddingInline: GUTTER,
    backgroundPosition: 'center bottom',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '100% auto',
    imageRendering: 'pixelated'
  },
  sky: (image: string) => ({ backgroundImage: image }),
  night: { backgroundColor: '#07172C' },
  dawn: { backgroundColor: '#262A5C' },
  day: { backgroundColor: '#196EB6' },
  afternoon: { backgroundColor: '#3A78A1' },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    width: '100%',
    maxWidth: 520,
    boxSizing: 'border-box',
    padding: 24,
    backgroundColor: siteColors.surface,
    border: `3px solid ${siteColors.accent}`,
    boxShadow: `8px 8px 0 ${siteColors.accent}`
  },
  title: {
    margin: 0,
    fontFamily: siteFonts.title,
    fontSize: 36,
    fontWeight: 700,
    lineHeight: '48px',
    textWrap: 'pretty'
  },
  mockup: {
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflowX: 'auto',
    border: `3px solid ${siteColors.ink}`,
    boxShadow: `8px 8px 0 ${siteColors.accent}`,
    backgroundColor: '#0F0F11'
  },
  mockupPending: { width: 1280, height: 163 },
  footer: {
    display: 'flex',
    alignItems: 'center',
    paddingBlock: 40,
    paddingInline: GUTTER,
    backgroundColor: siteColors.surface,
    borderTop: `1px solid ${siteColors.line}`
  },
  neopleLogo: { display: 'block' }
})
