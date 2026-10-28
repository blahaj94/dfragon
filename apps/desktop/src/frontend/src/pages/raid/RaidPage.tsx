import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import {
  type DragEvent,
  type KeyboardEvent,
  type RefCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '../../constants/cards'
import type { SlotCard, SlotCardActions } from '../../lib/slot-cards'
import { neighborSeat, type SeatDirection, type SeatOrder } from '../../lib/raid-seats'
import { RaidCard, type RaidCardMove } from '../../sections/RaidCard'
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
  slots,
  resetKey = 'raid',
  seats,
  actions = {}
}: {
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
  const id = useId()
  const { dragging, dropTarget, startDrag, hoverSeat, leaveSeat, endDrag } = useSeatDrag({
    resetKey,
    seatOrder,
    canMoveSeats
  })
  const [moveNotice, setMoveNotice] = useState({ text: '', sequence: 0 })
  const seatElements = useRef(new Map<number, HTMLDivElement>())
  // 카드가 새 자리로 옮겨 그려진 뒤 다시 포커스해 이어서 옮길 수 있게 한다.
  const movedSlot = useRef<number | null>(null)
  const hintId = `${id}-move-hint`

  useLayoutEffect(() => {
    const slot = movedSlot.current
    movedSlot.current = null
    if (slot === null) {
      return
    }
    const element = seatElements.current.get(slot)
    // 포커스가 남아 있는 카드에 다시 포커스하면 화면 낭독기가 같은 카드를 한 번 더 읽는다.
    if (element === undefined || document.activeElement === element) {
      return
    }
    element.focus()
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

  function renderSeat(seat: number, partyLabelId: string): React.JSX.Element {
    const slot = seatOrder[seat]
    const card = slots[slot]
    const drag = getSeatDrag(slot, dragging, dropTarget)
    const describedBy = canMoveSeats ? `${partyLabelId} ${hintId}` : partyLabelId
    const handleLookup =
      lookupSlot != null
        ? (nickname: string, serverId: string) => lookupSlot(slot, nickname, serverId)
        : undefined
    const seatRef: RefCallback<HTMLDivElement> = (element) => {
      if (element === null) {
        return
      }
      seatElements.current.set(slot, element)

      return () => {
        seatElements.current.delete(slot)
      }
    }
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
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
    }
    const handleDragStart = (event: DragEvent<HTMLDivElement>): void => {
      // 이름 칸의 선택한 글자를 드래그하는 동작은 자리 맞바꾸기가 아니다. 맞바꿀 수 없는 동안 시작한 드래그는
      // 다음 그리기에서 끝낸 것으로 본다.
      if (event.target !== event.currentTarget) {
        return
      }
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData(SEAT_DRAG_TYPE, String(seat + 1))
      startDrag(slot)
    }
    const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
      if (getDraggedSlot(event, dragging) === null) {
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      hoverSeat(slot)
    }
    const handleDragLeave = (event: DragEvent<HTMLDivElement>): void => {
      if (isEnteringInsideSeat(event)) {
        return
      }
      leaveSeat(slot)
    }
    const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
      const draggedSlot = getDraggedSlot(event, dragging)
      if (draggedSlot === null) {
        return
      }
      // 이름 칸에 놓아도 드래그한 자리 번호가 입력되지 않게 기본 동작을 막는다.
      event.preventDefault()
      const from = seatOrder.indexOf(draggedSlot)
      if (from !== seat) {
        swap(from, seat)
      }
      endDrag()
    }

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
          describedBy,
          ref: seatRef,
          onKeyDown: handleKeyDown,
          onDragStart: handleDragStart,
          onDragOver: handleDragOver,
          onDragLeave: handleDragLeave,
          onDrop: handleDrop,
          onDragEnd: endDrag
        }}
      />
    )
  }

  return (
    <section aria-label="공대" {...stylex.props(styles.page)}>
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
      <MoveHint id={hintId} />
      <MoveNotice notice={moveNotice} />
    </section>
  )
}

function useSeatDrag({
  resetKey,
  seatOrder,
  canMoveSeats
}: {
  resetKey: string
  seatOrder: SeatOrder
  canMoveSeats: boolean
}): {
  dragging: number | null
  dropTarget: number | null
  startDrag: (slot: number) => void
  hoverSeat: (slot: number) => void
  leaveSeat: (slot: number) => void
  endDrag: () => void
} {
  const [dragging, setDragging] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  // 드래그하던 카드가 회차나 배치 변경으로 다시 그려지면 dragend가 오지 않으므로, 그때와 맞바꿀 수 없게 될 때 드래그를
  // 끝낸 것으로 본다.
  const [dragBasis, setDragBasis] = useState({ resetKey, seatOrder })
  if (dragBasis.resetKey !== resetKey || dragBasis.seatOrder !== seatOrder) {
    setDragBasis({ resetKey, seatOrder })
    endDrag()
  } else if (!canMoveSeats && (dragging !== null || dropTarget !== null)) {
    endDrag()
  }

  function startDrag(slot: number): void {
    setDragging(slot)
    setDropTarget(null)
  }

  function hoverSeat(slot: number): void {
    setDropTarget(dragging === slot ? null : slot)
  }

  function leaveSeat(slot: number): void {
    setDropTarget((target) => (target === slot ? null : target))
  }

  function endDrag(): void {
    setDragging(null)
    setDropTarget(null)
  }

  return { dragging, dropTarget, startDrag, hoverSeat, leaveSeat, endDrag }
}

function getSeatDrag(
  slot: number,
  dragging: number | null,
  dropTarget: number | null
): RaidCardMove['drag'] {
  if (dragging === slot) {
    return 'source'
  }

  if (dropTarget === slot) {
    return 'target'
  }

  return undefined
}

function getDraggedSlot(event: DragEvent<HTMLDivElement>, dragging: number | null): number | null {
  if (dragging === null) {
    return null
  }

  if (!event.dataTransfer.types.includes(SEAT_DRAG_TYPE)) {
    return null
  }

  return dragging
}

function isEnteringInsideSeat(event: DragEvent<HTMLDivElement>): boolean {
  return event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)
}

function MoveHint({ id }: { id: string }): React.JSX.Element {
  return (
    <span id={id} {...stylex.props(shapes.srOnly)}>
      Alt와 방향키로 위, 아래, 왼쪽, 오른쪽 자리와 맞바꿉니다.
    </span>
  )
}

function MoveNotice({ notice }: { notice: { text: string; sequence: number } }): React.JSX.Element {
  // 같은 쌍을 다시 맞바꿔도 다시 읽히도록 두 알림 영역을 번갈아 채운다.
  return (
    <>
      <span role="status" {...stylex.props(shapes.srOnly)}>
        {notice.sequence % 2 === 1 ? notice.text : ''}
      </span>
      <span role="status" {...stylex.props(shapes.srOnly)}>
        {notice.sequence % 2 === 0 ? notice.text : ''}
      </span>
    </>
  )
}
