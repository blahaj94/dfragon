import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { SeatMoveNotice } from '../hooks/useSeatMove'
import { seatDirections, type SeatDirection, type SeatLayout } from '../lib/seats'

const directionLabels: Readonly<Record<SeatDirection, string>> = {
  up: '위',
  down: '아래',
  left: '왼쪽',
  right: '오른쪽'
}

export function SeatMoveStatus({
  hintId,
  layout,
  notice
}: {
  hintId: string
  layout: SeatLayout
  notice: SeatMoveNotice
}): React.JSX.Element {
  const directions = seatDirections(layout).map((direction) => directionLabels[direction])

  // 같은 쌍을 다시 맞바꿔도 다시 읽히도록 두 알림 영역을 번갈아 채운다.

  return (
    <>
      <span id={hintId} {...stylex.props(shapes.srOnly)}>
        {`Alt와 방향키로 ${directions.join(', ')} 자리와 맞바꿉니다.`}
      </span>
      <span role="status" {...stylex.props(shapes.srOnly)}>
        {notice.sequence % 2 === 1 ? notice.text : ''}
      </span>
      <span role="status" {...stylex.props(shapes.srOnly)}>
        {notice.sequence % 2 === 0 ? notice.text : ''}
      </span>
    </>
  )
}
