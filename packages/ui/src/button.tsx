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
  /** @default 'secondary' */
  variant?: ButtonVariant
  /** sm 32, md 40, lg 48px 높이. @default 'md' */
  size?: ButtonSize
  /**
   * 진행 중 표시. 클릭을 막지 않으므로 중복 실행을 막으려면 `disabled`도 함께 전달한다.
   * @default false
   */
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

// 일반 HTML button. 키보드, 포커스, disabled 동작은 native button을 그대로 따른다.
export const Button: ComponentType<ButtonProps> = ButtonImpl
