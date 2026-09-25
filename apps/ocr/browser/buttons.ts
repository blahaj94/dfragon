import * as stylex from '@stylexjs/stylex'
import { actionButton } from '@seed-design/css/recipes/action-button'
import { colors } from './theme.stylex.js'

// Keep SEED focus, pressed and disabled states; scope the Penpot palette to these buttons.
const appearance = stylex.create({
  button: {
    '--seed-color-bg-neutral-inverted': colors.primary,
    '--seed-color-bg-neutral-inverted-pressed': colors.primary,
    '--seed-color-fg-neutral-inverted': colors.onPrimary,
    '--seed-color-bg-neutral-weak': colors.control,
    '--seed-color-bg-neutral-weak-pressed': colors.border,
    '--seed-color-fg-neutral': colors.text,
    '--seed-color-bg-disabled': colors.control,
    '--seed-color-fg-disabled': colors.muted,
    '--seed-color-stroke-focus-ring': colors.accent,
    '--seed-font-weight-bold': '400',
    '--seed-font-size-t4': '14px',
    '--seed-line-height-t4': '20px',
    '--seed-dimension-x10': '44px',
    '--seed-radius-r2': '8px',
    opacity: { default: 1, ':disabled': 0.5 }
  }
})
const className = stylex.props(appearance.button).className
export const primary = `${actionButton({ variant: 'neutralSolid', size: 'medium' })} ${className}`
export const secondary = `${actionButton({ variant: 'neutralWeak', size: 'medium' })} ${className}`
