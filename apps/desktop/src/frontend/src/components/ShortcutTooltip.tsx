import { Tooltip } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactElement } from 'react'
import { styles } from './ShortcutTooltip.style'

// Windows 창 버튼은 상단 바 높이(44px)만큼 화면 위에 덮인다. 상단 바의 28px 버튼 아래로 12px을 띄워
// 툴팁이 캡처 창처럼 상단 바보다 4px 아래에서 시작하게 해, 창 버튼 쪽 툴팁 윗선이 가려지지 않게 한다.
const TOP_BAR_TOOLTIP_OFFSET = 12

export function ShortcutTooltip({
  label,
  shortcut,
  disabled,
  children
}: {
  label: string
  shortcut?: string
  disabled?: boolean
  children: ReactElement
}): React.JSX.Element {
  return (
    <Tooltip.Root disabled={disabled}>
      <Tooltip.Trigger delay={0} closeDelay={0} render={children} />
      <Tooltip.Popup side="bottom" sideOffset={TOP_BAR_TOOLTIP_OFFSET}>
        <span {...stylex.props(styles.label)}>{label}</span>
        {shortcut != null && <span {...stylex.props(styles.shortcut)}>{shortcut}</span>}
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}
