import * as stylex from '@stylexjs/stylex'
import type { ComponentType, ReactNode } from 'react'
import { controlStyles } from './control.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { shapes } from './shapes'
import { styles } from './icon-button.style'

export type IconButtonProps = Omit<PublicProps<'button'>, 'children'> & {
  'aria-label': string
  icon: ReactNode
  size?: 'sm' | 'md' | 'bar' | 'lg'
  pressed?: boolean
}

function IconButtonImpl({
  icon,
  size = 'md',
  pressed,
  className,
  style,
  ...buttonProps
}: IconButtonProps & ForwardedStyle) {
  return (
    <button
      {...buttonProps}
      aria-pressed={pressed ?? buttonProps['aria-pressed']}
      {...withForwardedStyle(
        stylex.props(
          styles.root,
          controlStyles.focusRing,
          controlStyles.hoverTransition,
          styles[size],
          size === 'lg' && shapes.cutTopRight,
          pressed === true && styles.pressed
        ),
        { className, style }
      )}
    >
      <span aria-hidden="true" {...stylex.props(styles.icon)}>
        {icon}
      </span>
    </button>
  )
}

export const IconButton: ComponentType<IconButtonProps> = IconButtonImpl
