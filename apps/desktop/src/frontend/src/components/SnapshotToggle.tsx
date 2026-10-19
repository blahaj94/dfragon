import { Popover } from '@base-ui/react/popover'
import { Button, IconButton, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import { SnapshotIcon } from './SnapshotIcon'
import { styles } from './SnapshotToggle.style'

/**
 * 머리의 모험단 순번 스냅샷 토글. 꺼진 버튼을 누르면 바로 스냅샷을 찍고, 켜진 버튼을 누르면 버튼 아래에
 * 끄기 확인을 연다. 확인 팝오버는 되돌릴 수 없는 삭제를 묻는 `alertdialog`라 취소 버튼에 먼저 포커스한다.
 */
export function SnapshotToggle({
  label,
  active,
  onTake,
  onClear
}: {
  /** 켜고 꺼도 바뀌지 않는 접근 가능한 이름 */
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
      <Popover.Trigger
        render={
          <IconButton size="lg" aria-label={label} pressed={active} icon={<SnapshotIcon />} />
        }
      />
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
