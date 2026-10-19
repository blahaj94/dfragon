import * as stylex from '@stylexjs/stylex'
import type { ComponentType, ReactNode } from 'react'
import { controlStyles } from './control.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { shapes } from './shapes'
import { styles } from './icon-button.style'

export type IconButtonProps = Omit<PublicProps<'button'>, 'children'> & {
  'aria-label': string
  icon: ReactNode
  /**
   * sm 32, md 40px 정사각형이고 아이콘은 각각 16, 24px이다. bar는 상단 바 도구 버튼의 36px 정사각형에
   * 20px 아이콘이다. lg는 화면 머리 도구의 48px 정사각형에 24px 아이콘이며 bg.inset 면에 오른쪽 위를
   * 자른다. @default 'md'
   */
  size?: 'sm' | 'md' | 'bar' | 'lg'
  /**
   * 켜고 끄는 토글 버튼의 켜짐 상태. 값을 주면 `aria-pressed`로 전하고, 켜진 동안 아이콘과 안쪽 2px 선이
   * 신호색이다. 값이 없으면 토글이 아니다.
   */
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

// 아이콘만 보이는 버튼. 접근 가능한 이름은 aria-label로 받는다. 나머지 button prop과 ref를 그대로
// 전달하므로 Base UI trigger의 render 대상으로 쓸 수 있다.
export const IconButton: ComponentType<IconButtonProps> = IconButtonImpl
