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
    borderColor: colors.borderDefault,
    borderRadius: 12,
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault
  },
  filters: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: 36 },
  // Design Chip on state: bg.brand.weak with a border.brand outline and fg.brand 700 text.
  // SEED chips mark selection with a neutral inverted fill, so the filter sets these colors.
  filterSelected: {
    backgroundColor: colors.bgBrandWeak,
    boxShadow: `inset 0 0 0 1px ${colors.borderBrand}`
  },
  filterSelectedLabel: { color: colors.fgBrand, fontWeight: 700 },
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
  listEmpty: { padding: 8, color: colors.fgMuted },
  error: { color: colors.fgDanger },
  muted: { color: colors.fgMuted },
  divider: {
    border: 0,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.borderDefault,
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
    borderColor: colors.borderDefault,
    borderRadius: 12,
    backgroundColor: colors.bgSurface,
    color: colors.fgDefault
  },
  summary: { display: 'flex', flexWrap: 'wrap', gap: '8px 20px' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  // Design secondary button: bg.control. SEED neutralWeak uses the gray step of bg.canvas in
  // light mode, so the button would disappear on the canvas.
  secondaryButton: {
    backgroundColor: {
      default: colors.bgControl,
      ':hover:not(:disabled)': colors.bgControlHover,
      ':disabled': 'var(--seed-color-bg-disabled)'
    }
  }
})
