import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  editor: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
  imageArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    width: '100%',
    height: 248,
    padding: 16,
    backgroundColor: colors.bgPreview,
    borderRadius: 8,
    overflow: 'hidden'
  },
  image: { maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated', objectFit: 'contain' },
  form: { display: 'flex', flexDirection: 'column', gap: 8 },
  actions: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 },
  primaryAction: { width: '100%' },
  secondaryActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8
  },
  muted: { color: colors.fgMuted }
})
