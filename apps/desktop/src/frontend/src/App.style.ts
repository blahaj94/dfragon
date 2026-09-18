import * as stylex from '@stylexjs/stylex'
import { colors } from './constants/theme.stylex'

export const styles = stylex.create({
  app: {
    minHeight: '100vh',
    boxSizing: 'border-box',
    backgroundColor: colors.background,
    color: colors.shellText,
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
  }
})
