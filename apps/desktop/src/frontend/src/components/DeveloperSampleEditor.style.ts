import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'
export const styles = stylex.create({
  editor: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
  imageArea: {
    minHeight: 96,
    padding: 16,
    backgroundColor: '#101216',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'auto',
    borderRadius: 8
  },
  image: { maxWidth: '100%', imageRendering: 'pixelated', objectFit: 'contain' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  result: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    overflowWrap: 'anywhere'
  },
  muted: { color: colors.shellMuted },
  error: { color: '#ed786e' }
})
