import * as stylex from '@stylexjs/stylex'
import { colors } from '../../constants/theme.stylex'

export const styles = stylex.create({
  header: {
    minHeight: 72,
    color: colors.fgDefault,
    paddingInline: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgSurface,
    borderRadius: 8,
    marginBottom: 16
  },
  actions: { display: 'flex', alignItems: 'center', gap: 8 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
    gap: 12,
    padding: 16,
    backgroundColor: colors.bgCanvas,
    borderRadius: 8
  }
})
