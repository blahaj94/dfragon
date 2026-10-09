import * as stylex from '@stylexjs/stylex'
import { actionButton } from '@seed-design/css/recipes/action-button'
import { controlChip } from '@seed-design/css/recipes/control-chip'
import { colors } from './theme.stylex.js'

// Keep SEED medium size, focus, pressed and disabled states; scope the design palette and the
// txtM label to these buttons because primary text needs txtM bold on bg.brand.solid.
const appearance = stylex.create({
  button: {
    '--seed-color-bg-brand-solid': colors.bgBrandSolid,
    '--seed-color-bg-brand-solid-pressed': colors.bgBrandSolidHover,
    '--seed-color-bg-neutral-weak': colors.bgControl,
    '--seed-color-bg-neutral-weak-pressed': colors.bgControlHover,
    '--seed-color-fg-neutral': colors.fgDefault,
    '--seed-color-stroke-focus-ring': colors.borderFocus,
    '--seed-font-size-t4': '16px',
    '--seed-line-height-t4': '24px'
  }
})
const className = stylex.props(appearance.button).className
export const primary = `${actionButton({ variant: 'brandSolid', size: 'medium' })} ${className}`
export const secondary = `${actionButton({ variant: 'neutralWeak', size: 'medium' })} ${className}`
export const chip = controlChip({ size: 'small' })
