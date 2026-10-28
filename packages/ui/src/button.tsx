import * as stylex from '@stylexjs/stylex'
import type { ComponentType } from 'react'
import { controlStyles } from './control.style'
import { LoadingIndicator } from './loading-indicator'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { shapes } from './shapes'
import { styles } from './button.style'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = PublicProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

function ButtonImpl({
  variant = 'secondary',
  size = 'md',
  loading = false,
  children,
  className,
  style,
  ...buttonProps
}: ButtonProps & ForwardedStyle) {
  const isPrimary = variant === 'primary'

  return (
    <button
      data-loading={loading ? '' : undefined}
      {...buttonProps}
      {...withForwardedStyle(
        stylex.props(
          styles.root,
          controlStyles.focusRing,
          controlStyles.hoverTransition,
          styles[size],
          styles[variant],
          isPrimary && shapes.cutTopRight
        ),
        { className, style }
      )}
    >
      {loading ? <LoadingIndicator>{children}</LoadingIndicator> : children}
    </button>
  )
}

export const Button: ComponentType<ButtonProps> = ButtonImpl
