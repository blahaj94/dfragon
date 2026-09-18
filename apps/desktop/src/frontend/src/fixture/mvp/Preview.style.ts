import * as stylex from '@stylexjs/stylex'
import { colors } from '../../constants/theme.stylex'

export const styles = stylex.create({
  app: {
    minHeight: '100vh',
    boxSizing: 'border-box',
    backgroundColor: colors.background,
    color: colors.text,
    padding: '16px 24px',
    fontFamily: 'NanumSquareNeo, sans-serif'
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginTop: 16,
    fontSize: 12,
    color: colors.shellMuted
  },
  select: {
    maxWidth: '100%',
    padding: 6,
    fontFamily: 'inherit',
    backgroundColor: colors.card,
    color: colors.text,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 6
  },
  notice: { fontSize: 12, lineHeight: 1.6, color: colors.shellMuted, margin: '12px 0 0' }
})
