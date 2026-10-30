import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
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

  return (
    <div
      ref={ref}
      aria-label={movable ? `${seat}번 자리, 끌어서 옮기기` : `${seat}번 자리`}
      role="group"
      aria-describedby={describedBy}
      aria-keyshortcuts={keyShortcuts}
      tabIndex={movable ? 0 : -1}
      draggable={movable}
      {...handlers}
      {...stylex.props(
        styles.seat,
        movable && styles.movable,
        drag === 'source' && styles.dragSource,
        drag === 'target' && styles.dragTarget
      )}
    >
      {children}
    </div>
  )
}
