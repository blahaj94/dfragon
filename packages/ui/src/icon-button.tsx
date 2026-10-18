import * as stylex from '@stylexjs/stylex'
import type { ComponentType, ReactNode } from 'react'
import { controlStyles } from './control.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './icon-button.style'

export type IconButtonProps = Omit<PublicProps<'button'>, 'children'> & {
  'aria-label': string
  icon: ReactNode
  /** sm 32, md 40px 정사각형. 아이콘은 각각 16, 24px이다. @default 'md' */
  size?: 'sm' | 'md'
}

function IconButtonImpl({
  icon,
  size = 'md',
  className,
  style,
  ...buttonProps
}: IconButtonProps & ForwardedStyle) {
  return (
    <button
      {...buttonProps}
      {...withForwardedStyle(
        stylex.props(
          styles.root,
          controlStyles.focusRing,
          controlStyles.hoverTransition,
          styles[size]
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

// 아이콘만 보이는 버튼. 접근 가능한 이름은 aria-label로 받는다. 나머지 button prop과 ref를 그대로
// 전달하므로 Base UI trigger의 render 대상으로 쓸 수 있다.
export const IconButton: ComponentType<IconButtonProps> = IconButtonImpl
