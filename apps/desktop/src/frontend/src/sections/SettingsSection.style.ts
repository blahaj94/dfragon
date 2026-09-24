import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  dialog: {
    width: 900,
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: 'calc(100dvh - 24px)',
    backgroundColor: colors.surface,
    color: colors.shellText,
    fontFamily: 'NanumSquareNeo, sans-serif',
    borderRadius: 12,
    overflow: 'hidden'
  },
  body: {
    display: 'flex',
    flexDirection: { default: 'row', '@media (max-width: 600px)': 'column' },
    minHeight: 0,
    height: 'min(540px, calc(100dvh - 110px))'
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    flexShrink: 0,
    width: { default: 196, '@media (max-width: 600px)': 'auto' },
    padding: { default: '24px 12px', '@media (max-width: 600px)': '8px 12px' }
  },
  group: {
    color: colors.shellMuted,
    paddingInline: 12,
    display: { default: 'block', '@media (max-width: 600px)': 'none' }
  },
  menu: {
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-start',
    padding: 12,
    borderRadius: 8,
    color: colors.shellText,
    textAlign: 'left'
  },
  menuSelected: { backgroundColor: '#45382f', color: '#ffad78' },
  menuSelectedLight: { backgroundColor: '#fff0e5', color: '#ab4d0c' },
  appName: {
    marginTop: 'auto',
    paddingInline: 12,
    color: colors.shellMuted,
    display: { default: 'block', '@media (max-width: 600px)': 'none' }
  },
  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflowY: 'auto',
    padding: { default: 28, '@media (max-width: 600px)': 16 },
    backgroundColor: colors.background
  },
  heading: { paddingBottom: 16 },
  developerDescription: { paddingBottom: 20, color: colors.shellMuted },
  developerActions: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  developerStatus: { paddingTop: 12, color: colors.shellMuted }
})
