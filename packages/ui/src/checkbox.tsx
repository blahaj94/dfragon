import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import * as stylex from '@stylexjs/stylex'
import type { ComponentType } from 'react'
import { controlStyles } from './control.style'
import { CheckIcon, DashIcon } from './icons'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './checkbox.style'

export type CheckboxProps = Omit<PublicProps<typeof BaseCheckbox.Root>, 'children'>

function CheckboxImpl({ className, style, ...props }: CheckboxProps & ForwardedStyle) {
  return (
    <BaseCheckbox.Root
      {...props}
      {...withForwardedStyle(stylex.props(styles.root, controlStyles.focusRing), {
        className,
        style
      })}
    >
      <BaseCheckbox.Indicator
        {...stylex.props(styles.indicator)}
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>{state.indeterminate ? <DashIcon /> : <CheckIcon />}</span>
        )}
      />
    </BaseCheckbox.Root>
  )
}

export const Checkbox: ComponentType<CheckboxProps> = CheckboxImpl
