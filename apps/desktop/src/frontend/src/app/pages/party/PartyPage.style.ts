import * as stylex from '@stylexjs/stylex'
import { colors } from '../../../config/theme.stylex'

export const styles = stylex.create({
  header: {
    minHeight: 72,
    color: colors.shellText,
    paddingInline: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 16
  },
  themeIcon: { color: colors.shellText, fontSize: 20 },
  actions: { display: 'flex', alignItems: 'center', gap: 8 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
    gap: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 8
  }
})
