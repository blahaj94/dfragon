import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '../constants/cards'

export type SeatDirection = 'up' | 'down' | 'left' | 'right'

export type SeatOrder = readonly number[]

export function createSeatOrder(): SeatOrder {
  return Array.from({ length: RAID_PARTY_COUNT * RAID_PARTY_SIZE }, (_, seat) => seat)
}

export function swapSeats(order: SeatOrder, from: number, to: number): SeatOrder {
  if (from === to || order[from] === undefined || order[to] === undefined) {
    return order
  }
  const next = [...order]
  next[from] = order[to]
  next[to] = order[from]

  return next
}

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
