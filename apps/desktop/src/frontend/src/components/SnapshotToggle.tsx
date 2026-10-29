import { Popover } from '@base-ui/react/popover'
import { Button, IconButton, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useRef } from 'react'
import { windowChromeStyles } from '../constants/window-chrome.style'
import { ShortcutTooltip } from './ShortcutTooltip'
import { SnapshotIcon } from './SnapshotIcon'
import { styles } from './SnapshotToggle.style'

export function SnapshotToggle({
  label,
  active,
  onTake,
  onClear
}: {
  label: string
  active: boolean
  onTake: () => void
  onClear: () => void
}): React.JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null)
  // 켜진 동안 누르면 끄기 확인이 열리고 Alt W는 아무것도 하지 않으므로 단축키 줄을 두지 않는다.
  const tooltipLabel = active ? '모험단 고정 풀기' : '모험단 고정하기'
  const tooltipShortcut = active ? undefined : 'Alt W'

  function handleOpenChange(open: boolean, details: Popover.Root.ChangeEventDetails): void {
    if (open && !active) {
      details.cancel()
      onTake()
    }
  }

  return (
    <Popover.Root onOpenChange={handleOpenChange}>
      <ShortcutTooltip label={tooltipLabel} shortcut={tooltipShortcut}>
        <span {...stylex.props(windowChromeStyles.noDrag)}>
          <Popover.Trigger
            render={
              <IconButton
                size="lg"
                aria-label={label}
                aria-keyshortcuts="Alt+W"
                pressed={active}
                icon={<SnapshotIcon width={16} height={16} {...stylex.props(styles.icon)} />}
                {...stylex.props(styles.trigger)}
              />
            }
          />
        </span>
      </ShortcutTooltip>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          {...stylex.props(styles.positioner)}
        >
          <Popover.Popup
            role="alertdialog"
            initialFocus={cancelRef}
            {...stylex.props(styles.popup, shapes.cutBottomRight)}
          >
            <Popover.Title {...stylex.props(styles.title)}>스냅샷을 지우시겠습니까?</Popover.Title>
            <div {...stylex.props(styles.actions)}>
              <Popover.Close ref={cancelRef} render={<Button variant="secondary" size="sm" />}>
                취소
              </Popover.Close>
              <Popover.Close render={<Button variant="primary" size="sm" />} onClick={onClear}>
                지우기
              </Popover.Close>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
