import * as stylex from '@stylexjs/stylex'
import { colors } from './constants/theme.stylex'

export const styles = stylex.create({
  app: {
    minHeight: '100vh',
    boxSizing: 'border-box',
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault,
    padding: '16px 24px'
  },
  workbench: { minHeight: 'calc(100dvh - 32px)' },
  brand: { display: 'flex', alignItems: 'center', gap: 8 },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    marginTop: 16,
    color: colors.fgMuted
  }
})
