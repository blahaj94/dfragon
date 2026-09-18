import * as stylex from '@stylexjs/stylex'
import { colors } from '../../constants/theme.stylex'

export const styles = stylex.create({
  image: { width: '100%', height: '100%', objectFit: 'contain' },
  zoom: { transform: 'scale(1.7)' },
  placeholder: {
    display: 'grid',
    placeItems: 'center',
    width: '100%',
    height: '100%',
    color: colors.muted,
    fontSize: 12
  }
})
