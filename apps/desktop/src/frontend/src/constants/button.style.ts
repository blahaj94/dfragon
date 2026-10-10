import * as stylex from '@stylexjs/stylex'
import { colors } from './theme.stylex'

export const buttonStyles = stylex.create({
  // Design secondary button: bg.control whatever surface it sits on. SEED neutralWeak is one
  // gray step lighter and, in light mode, the same gray as bg.canvas.
  secondary: {
    backgroundColor: {
      default: colors.bgControl,
      ':hover:not(:disabled)': colors.bgControlHover,
      ':disabled': 'var(--seed-color-bg-disabled)'
    }
  }
})
