import { Switch as BaseSwitch } from '@base-ui/react/switch'
import * as stylex from '@stylexjs/stylex'
import type { ComponentType } from 'react'
import { controlStyles } from './control.style'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './switch.style'

export type SwitchProps = Omit<PublicProps<typeof BaseSwitch.Root>, 'children'>

function SwitchImpl({ className, style, ...props }: SwitchProps & ForwardedStyle) {
  return (
    <BaseSwitch.Root
      {...props}
      {...withForwardedStyle(stylex.props(styles.root, controlStyles.focusRing), {
        className,
        style
      })}
    >
      <BaseSwitch.Thumb {...stylex.props(styles.thumb)} />
    </BaseSwitch.Root>
  )
}

export const Switch: ComponentType<SwitchProps> = SwitchImpl
