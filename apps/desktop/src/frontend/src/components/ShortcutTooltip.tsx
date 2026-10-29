import { Tooltip } from '@dfragon/ui'
import type { ReactElement } from 'react'

export function ShortcutTooltip({
  shortcut,
  children
}: {
  shortcut: string
  children: ReactElement
}): React.JSX.Element {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={0} closeDelay={0} render={children} />
      <Tooltip.Popup side="bottom">{shortcut}</Tooltip.Popup>
    </Tooltip.Root>
  )
}
