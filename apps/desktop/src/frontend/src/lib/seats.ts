export type SeatDirection = 'up' | 'down' | 'left' | 'right'

export type SeatOrder = readonly number[]

export type SeatLayout = { readonly rows: number; readonly columns: number }

export function createSeatOrder(layout: SeatLayout): SeatOrder {
  return Array.from({ length: layout.rows * layout.columns }, (_, seat) => seat)
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

const seatSteps: Readonly<Record<SeatDirection, { row: number; column: number }>> = {
  up: { row: -1, column: 0 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
  right: { row: 0, column: 1 }
}

export function neighborSeat(
  seat: number,
  direction: SeatDirection,
  layout: SeatLayout
): number | null {
  const step = seatSteps[direction]
  const row = Math.floor(seat / layout.columns) + step.row
  const column = (seat % layout.columns) + step.column
  const outside = row < 0 || row >= layout.rows || column < 0 || column >= layout.columns
  if (outside) {
    return null
  }

  return row * layout.columns + column
}

export function seatDirections(layout: SeatLayout): SeatDirection[] {
  const directions: SeatDirection[] = layout.rows > 1 ? ['up', 'down'] : []
  if (layout.columns > 1) {
    directions.push('left', 'right')
  }

  return directions
}
