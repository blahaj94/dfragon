import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  camera: { color: colors.shellText },
  active: { color: '#ff9f0a' },
  dialog: {
    width: 440,
    maxWidth: 'calc(100vw - 32px)',
    backgroundColor: colors.surface,
    color: colors.shellText,
    fontFamily: 'NanumSquareNeo, sans-serif',
    borderRadius: 16
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingRight: 24,
    fontSize: 20
  },
  state: { fontSize: 13, fontWeight: 400, color: colors.shellMuted, whiteSpace: 'nowrap' },
  select: {
    width: '100%',
    height: 44,
    paddingInline: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.shellText,
    fontFamily: 'inherit',
    fontSize: 14,
    ':focus-visible': { outline: '2px solid #ff9f0a', outlineOffset: 2 }
  },
  notice: {
    fontSize: 12,
    lineHeight: 1.6,
    color: colors.shellMuted,
    margin: '12px 0 0',
    overflowWrap: 'anywhere'
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 24
  },
  actions: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }
})
