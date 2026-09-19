import * as stylex from '@stylexjs/stylex'
import { colors } from '../../constants/theme.stylex'

export const styles = stylex.create({
  title: {
    color: colors.shellMuted,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }
})
