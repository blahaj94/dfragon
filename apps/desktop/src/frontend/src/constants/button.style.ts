import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'

export const buttonStyles = stylex.create({
  // Design secondary button: bg.control whatever surface it sits on. Disabled keeps bg.control
  // and the button's own fg.disabled text.
  secondary: {
    backgroundColor: {
      default: colors.bgControl,
      ':hover:not(:disabled)': colors.bgControlHover,
      ':disabled': colors.bgControl
    }
  }
})
