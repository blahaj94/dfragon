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

export const Chip: ComponentType<ChipProps> = ChipImpl
