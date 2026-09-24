import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  section: { display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 },
  connection: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 8,
    minHeight: 88,
    padding: '16px 20px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.shellText
  },
  connectionDetails: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  muted: { color: colors.shellMuted },
  error: { color: '#d34d4d' },
  crops: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(2, minmax(0, 1fr))',
      '@media (max-width: 520px)': 'repeat(2, minmax(0, 1fr))'
    },
    gap: 16
  },
  crop: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    boxSizing: 'border-box',
    minWidth: 0,
    height: 112,
    padding: '12px 16px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    color: colors.text
  },
  cropHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cropImage: {
    display: 'block',
    width: '100%',
    height: 64,
    objectFit: 'contain',
    imageRendering: 'pixelated'
  },
  cropImageArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#101216',
    borderRadius: 6
  },
  unchecked: { opacity: 0.32 },
  checkbox: { margin: 0, width: 18, height: 18, accentColor: colors.accent },
  emptyCrop: { color: '#aeb5bf' }
})
