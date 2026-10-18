import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const styles = stylex.create({
  title: {
    color: colors.fgMuted,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }
})
