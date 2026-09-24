import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  section: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
  layout: {
    display: 'grid',
    gridTemplateColumns: {
      default: '260px minmax(0, 1fr)',
      '@media (max-width: 640px)': 'minmax(0, 1fr)'
    },
    alignItems: 'start',
    gap: 20,
    minWidth: 0
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxSizing: 'border-box',
    minWidth: 0,
    minHeight: { default: 530, '@media (max-width: 640px)': 'auto' },
    padding: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.shellText
  },
  filters: { display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 36 },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 0,
    maxHeight: { default: 440, '@media (max-width: 640px)': 180 },
    overflowY: 'auto',
    margin: 0,
    padding: 2,
    listStyle: 'none'
  },
  listEmpty: { padding: 8, color: colors.shellMuted },
  error: { color: '#d34d4d' },
  muted: { color: colors.shellMuted },
  divider: {
    border: 0,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.border,
    width: '100%',
    margin: '8px 0'
  },
  evaluation: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.shellText
  },
  summary: { display: 'flex', flexWrap: 'wrap', gap: '8px 20px' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }
})
