import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    minWidth: 0
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  file: { maxWidth: '100%', color: colors.shellText },
  image: {
    display: 'block',
    width: '100%',
    height: 'auto',
    imageRendering: 'pixelated',
    userSelect: 'none',
    touchAction: 'none',
    cursor: 'crosshair',
    outline: '1px solid #737b87'
  },
  preview: { position: 'relative', maxWidth: '100%', lineHeight: 0 },
  selection: (left: number, top: number, width: number, height: number) => ({
    position: 'absolute',
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
    border: '2px solid #ffad78',
    backgroundColor: '#ffad781f',
    pointerEvents: 'none',
    boxSizing: 'border-box'
  }),
  coordinates: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 },
  muted: { color: colors.shellMuted },
  error: { color: '#ed786e' }
})
