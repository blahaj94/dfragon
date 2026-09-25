import * as stylex from '@stylexjs/stylex'
import { colors } from './theme.stylex'

export const styles = stylex.create({
  root: {
    width: 1126,
    maxWidth: '100%',
    margin: '0 auto',
    textAlign: 'center',
    borderInline: `1px solid ${colors.border}`,
    minHeight: '100svh',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box'
  },
  heading: {
    fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
    fontWeight: 500,
    color: colors.heading
  },
  title: {
    fontSize: { default: 56, '@media (max-width: 1024px)': 36 },
    letterSpacing: '-1.68px',
    margin: { default: '32px 0', '@media (max-width: 1024px)': '20px 0' }
  },
  subtitle: {
    fontSize: { default: 24, '@media (max-width: 1024px)': 20 },
    lineHeight: '118%',
    letterSpacing: '-0.24px',
    margin: '0 0 8px'
  },
  paragraph: { margin: 0 },
  code: {
    fontFamily: 'ui-monospace, Consolas, monospace',
    display: 'inline-flex',
    borderRadius: 4,
    color: colors.heading,
    fontSize: 15,
    lineHeight: '135%',
    padding: '4px 8px',
    backgroundColor: colors.code
  },
  hero: { position: 'relative' },
  heroImage: { insetInline: 0, margin: '0 auto' },
  base: { width: 170, position: 'relative', zIndex: 0 },
  framework: {
    position: 'absolute',
    zIndex: 1,
    top: 34,
    height: 28,
    transform: 'perspective(2000px) rotateZ(300deg) rotateX(44deg) rotateY(39deg) scale(1.4)'
  },
  vite: {
    position: 'absolute',
    zIndex: 0,
    top: 107,
    height: 26,
    width: 'auto',
    transform: 'perspective(2000px) rotateZ(300deg) rotateX(40deg) rotateY(39deg) scale(0.8)'
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    gap: { default: 25, '@media (max-width: 1024px)': 18 },
    placeContent: 'center',
    placeItems: 'center',
    flexGrow: 1,
    padding: { default: 0, '@media (max-width: 1024px)': '32px 20px 24px' }
  },
  nextSteps: {
    display: 'flex',
    borderTop: `1px solid ${colors.border}`,
    textAlign: { default: 'left', '@media (max-width: 1024px)': 'center' },
    flexDirection: { default: 'row', '@media (max-width: 1024px)': 'column' }
  },
  nextPanel: { flex: '1 1 0', padding: { default: 32, '@media (max-width: 1024px)': '24px 20px' } },
  docs: {
    borderRight: { default: `1px solid ${colors.border}`, '@media (max-width: 1024px)': 'none' },
    borderBottom: { default: 'none', '@media (max-width: 1024px)': `1px solid ${colors.border}` }
  },
  icon: { marginBottom: 16, width: 22, height: 22 },
  links: {
    listStyle: 'none',
    padding: 0,
    display: 'flex',
    gap: 8,
    margin: { default: '32px 0 0', '@media (max-width: 1024px)': '20px 0 0' },
    flexWrap: { default: 'nowrap', '@media (max-width: 1024px)': 'wrap' },
    justifyContent: { default: 'normal', '@media (max-width: 1024px)': 'center' }
  },
  linkItem: { flex: { default: '0 1 auto', '@media (max-width: 1024px)': '1 1 calc(50% - 8px)' } },
  logo: { height: 18 },
  link: {
    color: colors.heading,
    fontSize: 16,
    borderRadius: 6,
    backgroundColor: colors.social,
    display: 'flex',
    padding: '6px 12px',
    alignItems: 'center',
    gap: 8,
    textDecoration: 'none',
    transition: 'box-shadow 0.3s',
    boxShadow: { default: 'none', ':hover': colors.shadow },
    width: { default: 'auto', '@media (max-width: 1024px)': '100%' },
    justifyContent: { default: 'normal', '@media (max-width: 1024px)': 'center' },
    boxSizing: 'border-box'
  },
  buttonIcon: { height: 18, width: 18 },
  socialIcon: {
    filter: { default: 'none', '@media (prefers-color-scheme: dark)': 'invert(1) brightness(2)' }
  },
  spacer: {
    height: { default: 88, '@media (max-width: 1024px)': 48 },
    borderTop: `1px solid ${colors.border}`
  },
  ticks: {
    position: 'relative',
    width: '100%',
    '::before': {
      content: "''",
      position: 'absolute',
      top: -4.5,
      border: '5px solid transparent',
      left: 0,
      borderLeftColor: colors.border
    },
    '::after': {
      content: "''",
      position: 'absolute',
      top: -4.5,
      border: '5px solid transparent',
      right: 0,
      borderRightColor: colors.border
    }
  }
})
