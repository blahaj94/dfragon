import * as stylex from '@stylexjs/stylex'
import { colors } from '../../constants/theme.stylex'

export const styles = stylex.create({
  page: {
    minHeight: '100vh',
    boxSizing: 'border-box',
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault,
    padding: 20
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20
  },
  body: {
    display: 'grid',
    gap: 20,
    padding: 20,
    backgroundColor: colors.bgSurface,
    borderRadius: 12
  },
  identity: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20
  },
  image: {
    width: 160,
    height: 160,
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0
  },
  name: { overflowWrap: 'anywhere' },
  fields: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 20,
    margin: 0
  },
  field: { display: 'grid', gap: 8, minWidth: 0 },
  label: { color: colors.fgMuted },
  value: { margin: 0, overflowWrap: 'anywhere' },
  freshness: { display: 'grid', gap: 8, color: colors.fgMuted },
  notice: { color: colors.fgMuted }
})
