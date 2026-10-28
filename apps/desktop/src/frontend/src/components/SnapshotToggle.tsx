import { Popover } from '@base-ui/react/popover'
import { Button, IconButton, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import { windowChromeStyles } from '../constants/window-chrome.style'
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
  const [confirming, setConfirming] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Popover.Root
      open={confirming}
      onOpenChange={(open, details) => {
        if (open && !active) {
          details.cancel()
          onTake()

          return
        }
        setConfirming(open)
      }}
    >
      <span {...stylex.props(windowChromeStyles.noDrag)}>
        <Popover.Trigger
          render={
            <IconButton
              size="lg"
              aria-label={label}
              pressed={active}
              icon={<SnapshotIcon width={16} height={16} {...stylex.props(styles.icon)} />}
              {...stylex.props(styles.trigger)}
            />
          }
        />
      </span>
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
              <Button
                ref={cancelRef}
                variant="secondary"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                취소
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setConfirming(false)
                  onClear()
                }}
              >
                지우기
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
