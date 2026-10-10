import * as stylex from '@stylexjs/stylex'
import { colors } from './theme.stylex'

// Design Checkbox on SEED Checkbox.Control and Checkbox.Indicator.
export const checkboxStyles = stylex.create({
  // Off state: bg.inset with a border.strong line. StyleX rules outrank the SEED recipe, so the
  // background applies only at rest and SEED keeps its checked, hover, pressed and disabled
  // colors. SEED draws the off border with this stroke token, so the control scope points it
  // at border.strong.
  control: {
    backgroundColor: {
      default: null,
      ':not([data-checked], [data-indeterminate], [data-disabled], [data-hover], [data-active])':
        colors.bgInset
    },
    '--seed-color-stroke-neutral-weak': colors.borderStrong
  },
  // On state: a 16px check in place of the SEED 12px icon.
  indicator: { width: 16, height: 16 }
})
