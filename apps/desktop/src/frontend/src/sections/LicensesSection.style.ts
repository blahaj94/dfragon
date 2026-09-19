import * as stylex from '@stylexjs/stylex'
import { colors } from '../constants/theme.stylex'

export const styles = stylex.create({
  section: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    overflow: 'hidden'
  },
  light: { colorScheme: 'light' },
  dark: { colorScheme: 'dark' },
  document: {
    display: 'block',
    width: '100%',
    height: 'calc(100vh - 180px)',
    minHeight: 360,
    borderWidth: 0
  }
})
