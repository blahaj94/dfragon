import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '../constants/cards'

/** 키보드로 자리를 맞바꿀 방향. 위, 아래는 파티 사이, 왼쪽, 오른쪽은 같은 파티 안이다. */
export type SeatDirection = 'up' | 'down' | 'left' | 'right'

/**
 * 공대 보드의 자리 배치. `order[자리]`는 그 자리에 놓인 공대 검색 슬롯이다. 자리 번호는 화면의 1~12번
 * 순서이고, 검색 슬롯은 main 공대 검색 수명의 자리 번호다. 맞바꾸기는 배치만 바꾸므로 슬롯의 검색 상태,
 * 진행 중 요청과 늦은 응답은 같은 슬롯을 따라 옮겨 간 자리에 보인다.
 */
export type SeatOrder = readonly number[]

/** 자리와 검색 슬롯이 같은 처음 배치를 만든다. 공대 캡처 회차가 화면 행 순서대로 채울 때도 이 배치다. */
export function createSeatOrder(): SeatOrder {
  return Array.from({ length: RAID_PARTY_COUNT * RAID_PARTY_SIZE }, (_, seat) => seat)
}

/** 두 자리에 놓인 슬롯을 맞바꾼 새 배치를 돌려준다. 같은 자리나 범위 밖 자리는 배치를 그대로 둔다. */
export function swapSeats(order: SeatOrder, from: number, to: number): SeatOrder {
  if (from === to || order[from] === undefined || order[to] === undefined) {
    return order
  }
  const next = [...order]
  next[from] = order[to]
  next[to] = order[from]

  return next
}

/** 화면 자리 순서로 계산한 값을 검색 슬롯 순서로 다시 배치한다. `order`가 자리에 놓인 슬롯을 정한다. */
export function seatValuesToSlotOrder<T>(order: SeatOrder, bySeat: readonly T[]): T[] {
  const bySlot: T[] = []
  for (const [seat, slot] of order.entries()) {
    bySlot[slot] = bySeat[seat]
  }

  return bySlot
}

const seatSteps: Readonly<Record<SeatDirection, { party: number; member: number }>> = {
  up: { party: -1, member: 0 },
  down: { party: 1, member: 0 },
  left: { party: 0, member: -1 },
  right: { party: 0, member: 1 }
}

/** 한 자리에서 방향으로 이웃한 자리. 보드 가장자리를 넘으면 null이다. */
export function neighborSeat(seat: number, direction: SeatDirection): number | null {
  const step = seatSteps[direction]
  const party = Math.floor(seat / RAID_PARTY_SIZE) + step.party
  const member = (seat % RAID_PARTY_SIZE) + step.member
  const outside = party < 0 || party >= RAID_PARTY_COUNT || member < 0 || member >= RAID_PARTY_SIZE
  if (outside) {
    return null
  }

  return party * RAID_PARTY_SIZE + member
}
