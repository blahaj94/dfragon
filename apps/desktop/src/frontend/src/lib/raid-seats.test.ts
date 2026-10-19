import { describe, expect, it } from 'vitest'
import { createSeatOrder, seatValuesToSlotOrder, swapSeats } from './raid-seats'

describe('seatValuesToSlotOrder', () => {
  it('처음 배치는 값을 그대로 둔다', () => {
    const bySeat = Array.from({ length: 12 }, (_, seat) => `자리${seat}`)

    expect(seatValuesToSlotOrder(createSeatOrder(), bySeat)).toEqual(bySeat)
  })

  it('맞바꾼 자리의 값은 그 자리에 놓인 슬롯 번호로 옮긴다', () => {
    const order = swapSeats(createSeatOrder(), 0, 3)
    const bySeat = Array.from({ length: 12 }, (_, seat) => `자리${seat}`)

    const bySlot = seatValuesToSlotOrder(order, bySeat)

    expect(bySlot[3]).toBe('자리0')
    expect(bySlot[0]).toBe('자리3')
    expect(bySlot[1]).toBe('자리1')
  })
})
