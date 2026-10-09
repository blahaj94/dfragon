import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  button: { width: '100%', justifyContent: 'flex-start', textAlign: 'left' },
  selected: {
    backgroundColor: { default: colors.bgBrandWeak, ':hover': colors.bgBrandWeak },
    boxShadow: `inset 0 0 0 1px ${colors.borderBrand}`
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr)',
    alignItems: 'center',
    gap: 10,
    width: '100%'
  },
  thumbnail: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 44,
    overflow: 'hidden',
    borderRadius: 5,
    backgroundColor: colors.bgPreview
  },
  image: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', imageRendering: 'pixelated' },
  placeholder: { color: colors.fgMuted },
  description: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  overflow: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  muted: { color: colors.fgMuted },
  selectedState: { color: colors.fgBrand }
})
