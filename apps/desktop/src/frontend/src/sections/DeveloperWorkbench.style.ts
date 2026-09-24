import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'
export const styles = stylex.create({
  workbench: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    color: colors.shellText,
    padding: 16,
    minWidth: 0
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  columns: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 1fr) minmax(0, 1fr)',
      '@media (max-width: 700px)': 'minmax(0, 1fr)'
    },
    gap: 16,
    alignItems: 'start'
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    minWidth: 0
  },
  list: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    maxHeight: 144,
    overflowY: 'auto',
    margin: 0,
    padding: 2,
    listStyle: 'none'
  },
  summary: { display: 'flex', flexWrap: 'wrap', gap: 16 },
  muted: { color: colors.shellMuted },
  error: { color: '#ed786e' }
})
