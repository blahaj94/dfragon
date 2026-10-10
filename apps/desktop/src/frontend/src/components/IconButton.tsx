import * as stylex from '@stylexjs/stylex'
import { Icon } from '@seed-design/react'
import { ActionButton, type ActionButtonProps } from '@dfragon/ui'
import { styles } from './IconButton.style'

type IconButtonProps = Omit<ActionButtonProps, 'size' | 'layout' | 'variant' | 'children'> & {
  variant: 'neutralWeak' | 'ghost'
  'aria-label': string
  icon: React.ReactNode
}

/** 디자인 IconButton md: SEED medium iconOnly 버튼 안에 24px 아이콘을 둔 40 정사각형이다. */
export function IconButton({ icon, ...buttonProps }: IconButtonProps): React.JSX.Element {
  return (
    <ActionButton size="medium" layout="iconOnly" {...buttonProps} {...stylex.props(styles.square)}>
      <Icon svg={icon} size="x6" />
    </ActionButton>
  )
}
