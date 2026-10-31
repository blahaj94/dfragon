import * as stylex from '@stylexjs/stylex'
import { type FocusEvent, type ReactNode, useState } from 'react'
import type { SeatMove } from '../hooks/useSeatMove'
import { styles } from './Seat.style'

export function Seat({
  seat,
  move,
  describedBy,
  children
}: {
  seat: number
  move: SeatMove
  describedBy?: string
  children: ReactNode
}): React.JSX.Element {
  const { movable, drag, keyShortcuts, ref, ...handlers } = move
  const [editingName, setEditingName] = useState(false)
  // Chromium은 draggable 조상 안의 입력에서 누른 채 끌면 글자 선택 대신 조상 드래그를 시작하므로, 이름을 고치는
  // 동안은 카드를 끌 수 없게 해 이름을 끌어 선택하고 복사할 수 있게 한다.
  const draggable = movable && !editingName
  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.target instanceof HTMLInputElement) {
      setEditingName(true)
    }
  }
  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.target instanceof HTMLInputElement) {
      setEditingName(false)
    }
  }

  return (
    <div
      ref={ref}
      aria-label={movable ? `${seat}번 자리, 끌어서 옮기기` : `${seat}번 자리`}
      role="group"
      aria-describedby={describedBy}
      aria-keyshortcuts={keyShortcuts}
      tabIndex={movable ? 0 : -1}
      draggable={draggable}
      onFocus={onFocus}
      onBlur={onBlur}
      {...handlers}
      {...stylex.props(
        styles.seat,
        draggable && styles.movable,
        drag === 'source' && styles.dragSource,
        drag === 'target' && styles.dragTarget
      )}
    >
      {children}
    </div>
  )
}
