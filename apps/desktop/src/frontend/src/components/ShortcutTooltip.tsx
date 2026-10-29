import { Tooltip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactElement } from 'react'
import { styles } from './ShortcutTooltip.style'

export function ShortcutTooltip({
  label,
  shortcut,
  children
}: {
  label: string
  shortcut?: string
  children: ReactElement
}): React.JSX.Element {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={0} closeDelay={0} render={children} />
      <Tooltip.Popup side="bottom">
        <span {...stylex.props(styles.label)}>{label}</span>
        {shortcut != null && <span {...stylex.props(styles.shortcut)}>{shortcut}</span>}
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
