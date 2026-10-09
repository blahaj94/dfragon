import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  notice: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 16px',
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
    borderLeftColor: colors.accent,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.shellText
  },
  message: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  detail: { color: colors.shellMuted },
  actions: { display: 'flex', alignItems: 'center', gap: 8 }
})
