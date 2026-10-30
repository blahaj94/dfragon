import { useCallback, useState } from 'react'
import {
  createSeatOrder,
  swapSeats as swapSeatOrder,
  type SeatLayout,
  type SeatOrder
} from '../lib/seats'

export type SeatArrangement = {
  layout: SeatLayout
  seatOrder: SeatOrder
  canMoveSeats: boolean
  swapSeats: (from: number, to: number) => boolean
}

/**
 * 화면 자리에 놓인 검색 슬롯 순서를 소유한다. 맞바꾸기는 화면 자리만 바꾸고 main 검색 수명의 슬롯 번호는 그대로
 * 두므로, 맞바꾼 뒤에도 진행 중 조회와 늦은 응답은 같은 슬롯, 곧 옮겨 간 카드에 들어간다.
 */
export function useSeatOrder(layout: SeatLayout): {
  seatOrder: SeatOrder
  swapSeats: (from: number, to: number) => boolean
  resetSeats: () => void
} {
  const [seatOrder, setSeatOrder] = useState(() => createSeatOrder(layout))
  const resetSeats = useCallback(() => setSeatOrder(createSeatOrder(layout)), [layout])
  const swapSeats = (from: number, to: number): boolean => {
    const next = swapSeatOrder(seatOrder, from, to)
    if (next === seatOrder) {
      return false
    }
    setSeatOrder(next)

    return true
  }

  return { seatOrder, swapSeats, resetSeats }
}
