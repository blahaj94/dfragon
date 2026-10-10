import * as stylex from '@stylexjs/stylex'
import { Icon } from '@seed-design/react'
import type { ReactNode } from 'react'
import { ActionButton } from './seed/action-button'
import type { PublicProps } from './public-props'
import { styles } from './icon-button.style'

export type IconButtonProps = Omit<
  PublicProps<typeof ActionButton>,
  'size' | 'layout' | 'variant' | 'children'
> & {
  variant: 'neutralWeak' | 'ghost'
  'aria-label': string
  icon: ReactNode
}

// DFragon 디자인 컴포넌트: IconButton md는 SEED medium iconOnly 버튼 안에 24px Icon을 둔 40 정사각형이다.
export function IconButton({ icon, ...buttonProps }: IconButtonProps) {
  return (
    <ActionButton size="medium" layout="iconOnly" {...buttonProps} {...stylex.props(styles.square)}>
      <Icon svg={icon} size="x6" />
    </ActionButton>
  )
}
