import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import * as stylex from '@stylexjs/stylex'
import type { ComponentType, HTMLAttributes } from 'react'
import { controlStyles } from './control.style'
import { CheckIcon, DashIcon } from './icons'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './checkbox.style'

export type CheckboxProps = Omit<PublicProps<typeof BaseCheckbox.Root>, 'children'>

function renderIndicator(
  indicatorProps: HTMLAttributes<HTMLSpanElement>,
  state: { indeterminate: boolean }
) {
  const icon = state.indeterminate ? <DashIcon /> : <CheckIcon />

  return <span {...indicatorProps}>{icon}</span>
}

function CheckboxImpl({ className, style, ...props }: CheckboxProps & ForwardedStyle) {
  return (
    <BaseCheckbox.Root
      {...props}
      {...withForwardedStyle(stylex.props(styles.root, controlStyles.focusRing), {
        className,
        style
      })}
    >
      <BaseCheckbox.Indicator {...stylex.props(styles.indicator)} render={renderIndicator} />
    </BaseCheckbox.Root>
  )
}

export const Checkbox: ComponentType<CheckboxProps> = CheckboxImpl
