import { Toggle } from '@base-ui/react/toggle'
import * as stylex from '@stylexjs/stylex'
import type { ComponentType } from 'react'
import { controlStyles } from './control.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './chip.style'

export type ChipProps = PublicProps<typeof Toggle>

function ChipImpl({ className, style, ...props }: ChipProps & ForwardedStyle) {
  return (
    <Toggle
      {...props}
      {...withForwardedStyle(
        stylex.props(styles.root, controlStyles.focusRing, controlStyles.hoverTransition),
        { className, style }
      )}
    />
  )
}

// Base UI Toggle. 켜고 끄는 선택 칩이며 aria-pressed로 상태를 알린다.
export const Chip: ComponentType<ChipProps> = ChipImpl
