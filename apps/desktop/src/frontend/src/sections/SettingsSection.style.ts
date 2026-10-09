import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  dialog: {
    width: 900,
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: 'calc(100dvh - 24px)',
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault,
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
    color: colors.fgMuted,
    paddingInline: 12,
    display: { default: 'block', '@media (max-width: 600px)': 'none' }
  },
  menu: {
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-start',
    padding: 12,
    borderRadius: 8,
    color: colors.fgDefault,
    textAlign: 'left'
  },
  menuSelected: { backgroundColor: colors.bgBrandWeak },
  appName: {
    marginTop: 'auto',
    paddingInline: 12,
    color: colors.fgMuted,
    display: { default: 'flex', '@media (max-width: 600px)': 'none' },
    alignItems: 'center',
    gap: 8
  },
  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflowY: 'auto',
    padding: { default: 28, '@media (max-width: 600px)': 16 },
    backgroundColor: colors.bgCanvas
  },
  heading: { paddingBottom: 16 },
  developerDescription: { paddingBottom: 20, color: colors.fgMuted },
  developerActions: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  developerStatus: { paddingTop: 12, color: colors.fgMuted }
})
