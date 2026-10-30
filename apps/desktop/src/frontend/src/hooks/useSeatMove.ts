import {
  type DragEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type RefCallback,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { neighborSeat, seatDirections, type SeatDirection } from '../lib/seats'
import type { SeatArrangement } from './useSeatOrder'

export type SeatMove = Pick<
  HTMLAttributes<HTMLDivElement>,
  'onDragStart' | 'onDragOver' | 'onDragLeave' | 'onDrop' | 'onDragEnd' | 'onKeyDown'
> & {
  movable: boolean
  drag?: 'source' | 'target'
  keyShortcuts?: string
  ref: RefCallback<HTMLDivElement>
}

export type SeatMoveNotice = { text: string; sequence: number }

const SEAT_DRAG_TYPE = 'application/x-dfragon-seat'
const seatKeys: Readonly<Record<string, SeatDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right'
}
const directionKeys: Readonly<Record<SeatDirection, string>> = {
  up: 'Alt+ArrowUp',
  down: 'Alt+ArrowDown',
  left: 'Alt+ArrowLeft',
  right: 'Alt+ArrowRight'
}

export function useSeatMove({ resetKey, seats }: { resetKey: string; seats: SeatArrangement }): {
  moveSeat: (seat: number) => SeatMove
  notice: SeatMoveNotice
} {
  const { layout, seatOrder, canMoveSeats, swapSeats } = seats
  const { dragging, dropTarget, startDrag, hoverSeat, leaveSeat, endDrag } = useSeatDrag({
    resetKey,
    seatOrder,
    canMoveSeats
  })
  const [notice, setNotice] = useState<SeatMoveNotice>({ text: '', sequence: 0 })
  const seatElements = useRef(new Map<number, HTMLDivElement>())
  const movedSlot = useRef<number | null>(null)
  const keyShortcuts = canMoveSeats
    ? seatDirections(layout)
        .map((direction) => directionKeys[direction])
        .join(' ')
    : undefined

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
      setNotice((previous) => ({ text, sequence: previous.sequence + 1 }))
    }

    return swapped
  }

  function moveSeat(seat: number): SeatMove {
    const slot = seatOrder[seat]
    const ref: RefCallback<HTMLDivElement> = (element) => {
      if (element === null) {
        return
      }
      seatElements.current.set(slot, element)

      return () => {
        seatElements.current.delete(slot)
      }
    }
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.target !== event.currentTarget || !event.altKey) {
        return
      }
      const direction = seatKeys[event.key]
      if (direction == null || !canMoveSeats) {
        return
      }
      const target = neighborSeat(seat, direction, layout)
      if (target === null) {
        return
      }
      event.preventDefault()
      if (swap(seat, target)) {
        movedSlot.current = slot
      }
    }
    const onDragStart = (event: DragEvent<HTMLDivElement>): void => {
      // 이름 칸의 선택한 글자를 드래그하는 동작은 자리 맞바꾸기가 아니다. 맞바꿀 수 없는 동안 시작한 드래그는
      // 다음 그리기에서 끝낸 것으로 본다.
      if (event.target !== event.currentTarget) {
        return
      }
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData(SEAT_DRAG_TYPE, String(seat + 1))
      startDrag(slot)
    }
    const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
      if (getDraggedSlot(event, dragging) === null) {
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      hoverSeat(slot)
    }
    const onDragLeave = (event: DragEvent<HTMLDivElement>): void => {
      if (isEnteringInsideSeat(event)) {
        return
      }
      leaveSeat(slot)
    }
    const onDrop = (event: DragEvent<HTMLDivElement>): void => {
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
    const drag = getSeatDrag(slot, dragging, dropTarget)

    return {
      movable: canMoveSeats,
      drag,
      keyShortcuts,
      ref,
      onKeyDown,
      onDragStart,
      onDragOver,
      onDragLeave,
      onDrop,
      onDragEnd: endDrag
    }
  }

  return { moveSeat, notice }
}

function useSeatDrag({
  resetKey,
  seatOrder,
  canMoveSeats
}: {
  resetKey: string
  seatOrder: SeatArrangement['seatOrder']
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
): SeatMove['drag'] {
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
