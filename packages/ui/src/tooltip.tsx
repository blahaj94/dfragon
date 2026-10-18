import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import * as stylex from '@stylexjs/stylex'
import type { ComponentType } from 'react'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'
import { styles } from './tooltip.style'

export type TooltipPopupProps = PublicProps<typeof BaseTooltip.Popup> &
  Pick<BaseTooltip.Portal.Props, 'container'> &
  Pick<BaseTooltip.Positioner.Props, 'side' | 'align' | 'sideOffset'>

// Portal, Positioner, Popup을 묶은 설명 상자.
function TooltipPopupImpl({
  container,
  side = 'top',
  align = 'center',
  sideOffset = 6,
  className,
  style,
  ...props
}: TooltipPopupProps & ForwardedStyle) {
  return (
    <BaseTooltip.Portal container={container}>
      <BaseTooltip.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        {...stylex.props(styles.positioner)}
      >
        <BaseTooltip.Popup
          {...props}
          {...withForwardedStyle(stylex.props(styles.popup), { className, style })}
        />
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}

const TooltipPopup: ComponentType<TooltipPopupProps> = TooltipPopupImpl

/** Base UI Tooltip 부품. Provider, Root, Trigger는 Base UI 그대로이고 Popup만 외형을 그린다. */
export const Tooltip = {
  Provider: BaseTooltip.Provider,
  Root: BaseTooltip.Root,
  Trigger: BaseTooltip.Trigger,
  Popup: TooltipPopup
}
