import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '../../constants/cards'
import type { SlotCard, SlotCardActions } from '../../lib/slot-cards'
import { neighborSeat, type SeatDirection, type SeatOrder } from '../../lib/raid-seats'
import { RaidCard } from '../../sections/RaidCard'
import { styles } from './RaidPage.style'

const parties = Array.from({ length: RAID_PARTY_COUNT }, (_, party) =>
  Array.from({ length: RAID_PARTY_SIZE }, (_, member) => party * RAID_PARTY_SIZE + member)
)
const SEAT_DRAG_TYPE = 'application/x-dfragon-raid-seat'
const seatKeys: Readonly<Record<string, SeatDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right'
}

export function RaidPage({
  id,
  header,
  slots,
  resetKey = 'raid',
  seats,
  actions = {}
}: {
  id: string
  header: ReactNode
  slots: readonly SlotCard[]
  resetKey?: string
  seats: {
    seatOrder: SeatOrder
    canMoveSeats: boolean
    swapSeats: (from: number, to: number) => boolean
  }
  actions?: Pick<SlotCardActions, 'lookupSlot'>
}): React.JSX.Element {
  const { seatOrder, canMoveSeats, swapSeats } = seats
  const { lookupSlot } = actions
  const [dragging, setDragging] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  // 드래그하던 카드가 회차나 배치 변경으로 다시 그려지면 dragend가 오지 않으므로, 그때와 맞바꿀 수 없게 될 때 드래그를
  // 끝낸 것으로 본다.
  const [dragBasis, setDragBasis] = useState({ resetKey, seatOrder })
  if (dragBasis.resetKey !== resetKey || dragBasis.seatOrder !== seatOrder) {
    setDragBasis({ resetKey, seatOrder })
    setDragging(null)
    setDropTarget(null)
  } else if (!canMoveSeats && (dragging !== null || dropTarget !== null)) {
    setDragging(null)
    setDropTarget(null)
  }
  // 같은 쌍을 다시 맞바꿔도 다시 읽히도록 두 알림 영역을 번갈아 채운다.
  const [moveNotice, setMoveNotice] = useState({ text: '', sequence: 0 })
  const seatElements = useRef(new Map<number, HTMLDivElement>())
  // 카드가 새 자리로 옮겨 그려진 뒤 다시 포커스해 이어서 옮길 수 있게 한다.
  const movedSlot = useRef<number | null>(null)
  const hintId = `${id}-move-hint`

  useLayoutEffect(() => {
    const slot = movedSlot.current
    movedSlot.current = null
    const element = slot === null ? undefined : seatElements.current.get(slot)
    // 카드를 옮기면서 포커스를 잃었을 때만 되돌린다. 포커스가 남아 있으면 같은 카드를 다시 읽히지 않는다.
    if (element !== undefined && document.activeElement !== element) {
      element.focus()
    }
  }, [seatOrder])

  function swap(from: number, to: number): boolean {
    const swapped = swapSeats(from, to)
    if (swapped) {
      const text = `${from + 1}번 자리와 ${to + 1}번 자리를 맞바꿨습니다.`
      setMoveNotice((previous) => {
        const sequence = previous.sequence + 1

        return { text, sequence }
      })
    }

    return swapped
  }

  function endDrag(): void {
    setDragging(null)
    setDropTarget(null)
  }

  function renderSeat(seat: number, partyLabelId: string): React.JSX.Element {
    const slot = seatOrder[seat]
    const card = slots[slot]
    let drag: 'source' | 'target' | undefined
    if (dragging === slot) {
      drag = 'source'
    } else if (dropTarget === slot) {
      drag = 'target'
    }
    const handleLookup =
      lookupSlot != null
        ? (nickname: string, serverId: string) => lookupSlot(slot, nickname, serverId)
        : undefined

    return (
      <RaidCard
        key={`${resetKey}-${slot}`}
        cardKey={{ id: `raid-${slot}`, resetKey }}
        card={card}
        slot={seat + 1}
        onLookup={handleLookup}
        move={{
          movable: canMoveSeats,
          drag,
          describedBy: canMoveSeats ? `${partyLabelId} ${hintId}` : partyLabelId,
          ref: (element) => {
            if (element === null) {
              return
            }
            seatElements.current.set(slot, element)

            return () => {
              seatElements.current.delete(slot)
            }
          },
          onKeyDown: (event) => {
            if (event.target !== event.currentTarget || !event.altKey) {
              return
            }
            const direction = seatKeys[event.key]
            if (direction == null || !canMoveSeats) {
              return
            }
            const target = neighborSeat(seat, direction)
            if (target === null) {
              return
            }
            event.preventDefault()
            if (swap(seat, target)) {
              movedSlot.current = slot
            }
          },
          onDragStart: (event) => {
            // 이름 칸의 선택한 글자를 드래그하는 동작은 자리 맞바꾸기가 아니다. 맞바꿀 수 없는 동안 시작한 드래그는
            // 다음 그리기에서 끝낸 것으로 본다.
            if (event.target !== event.currentTarget) {
              return
            }
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData(SEAT_DRAG_TYPE, String(seat + 1))
            setDragging(slot)
            setDropTarget(null)
          },
          onDragOver: (event) => {
            if (dragging === null || !event.dataTransfer.types.includes(SEAT_DRAG_TYPE)) {
              return
            }
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropTarget(dragging === slot ? null : slot)
          },
          onDragLeave: (event) => {
            const inside =
              event.relatedTarget instanceof Node &&
              event.currentTarget.contains(event.relatedTarget)
            if (!inside) {
              setDropTarget((target) => (target === slot ? null : target))
            }
          },
          onDrop: (event) => {
            if (dragging === null || !event.dataTransfer.types.includes(SEAT_DRAG_TYPE)) {
              return
            }
            // 이름 칸에 놓아도 드래그한 자리 번호가 입력되지 않게 기본 동작을 막는다.
            event.preventDefault()
            const from = seatOrder.indexOf(dragging)
            if (from !== seat) {
              swap(from, seat)
            }
            endDrag()
          },
          onDragEnd: endDrag
        }}
      />
    )
  }

  return (
    <section aria-label="공대" {...stylex.props(styles.page)}>
      {header}
      <div id={id} {...stylex.props(styles.scroller)}>
        <div {...stylex.props(styles.board)}>
          {parties.flatMap((seats, party) => {
            // 파티 이름과 카드를 한 배열로 펼쳐 모든 카드가 같은 부모 아래에서 옮겨 다니게 한다.
            const partyLabelId = `${id}-party-${party + 1}`

            return [
              <span key={partyLabelId} id={partyLabelId} {...stylex.props(shapes.srOnly)}>
                {party + 1}파티
              </span>,
              ...seats.map((seat) => renderSeat(seat, partyLabelId))
            ]
          })}
        </div>
      </div>
      <span id={hintId} {...stylex.props(shapes.srOnly)}>
        Alt와 방향키로 위, 아래, 왼쪽, 오른쪽 자리와 맞바꿉니다.
      </span>
      <span role="status" {...stylex.props(shapes.srOnly)}>
        {moveNotice.sequence % 2 === 1 ? moveNotice.text : ''}
      </span>
      <span role="status" {...stylex.props(shapes.srOnly)}>
        {moveNotice.sequence % 2 === 0 ? moveNotice.text : ''}
      </span>
    </section>
  )
}
