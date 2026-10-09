import * as stylex from '@stylexjs/stylex'
import { actionButton } from '@seed-design/css/recipes/action-button'
import { controlChip } from '@seed-design/css/recipes/control-chip'
import { colors } from './theme.stylex.js'

// Keep SEED sizes, focus, pressed and disabled states; scope the design palette and the label
// size to these buttons because primary text needs txtM bold on bg.brand.solid.
const appearance = stylex.create({
  button: {
    '--seed-color-bg-brand-solid': colors.bgBrandSolid,
    '--seed-color-bg-brand-solid-pressed': colors.bgBrandSolidHover,
    '--seed-color-bg-neutral-weak': colors.bgControl,
    '--seed-color-bg-neutral-weak-pressed': colors.bgControlHover,
    '--seed-font-size-t4': '16px',
    '--seed-line-height-t4': '24px'
  },
  small: {
    '--seed-font-size-t4': '14px',
    '--seed-line-height-t4': '20px'
  }
})
const className = stylex.props(appearance.button).className
const smallClassName = stylex.props(appearance.button, appearance.small).className
export const primary = `${actionButton({ variant: 'brandSolid', size: 'medium' })} ${className}`
export const secondary = `${actionButton({ variant: 'neutralWeak', size: 'medium' })} ${className}`
export const secondarySmall = `${actionButton({ variant: 'neutralWeak', size: 'small' })} ${smallClassName}`
export const chip = controlChip({ size: 'small' })
