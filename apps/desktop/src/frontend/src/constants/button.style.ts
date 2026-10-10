import * as stylex from '@stylexjs/stylex'
import { colors } from './theme.stylex'

export const buttonStyles = stylex.create({
  // Design secondary button: bg.control. SEED neutralWeak uses the gray step of bg.canvas in
  // light mode, so a neutralWeak button placed directly on bg.canvas would disappear.
  secondaryOnCanvas: {
    backgroundColor: {
      default: colors.bgControl,
      ':hover:not(:disabled)': colors.bgControlHover,
      ':disabled': 'var(--seed-color-bg-disabled)'
    }
  }
})
