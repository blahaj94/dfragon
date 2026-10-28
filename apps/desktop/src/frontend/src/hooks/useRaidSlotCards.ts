import { slotAdventureName } from '../lib/adventure-snapshot'
import { seatValuesToSlotOrder } from '../lib/raid-seats'
import { toSlotCards, type SlotCard } from '../lib/slot-cards'
import { useAdventureSnapshot } from './useAdventureSnapshot'
import type { RaidCapture } from './useRaidCapture'

export function useRaidSlotCards(capture: RaidCapture): {
  cards: SlotCard[]
  snapshot: ReturnType<typeof useAdventureSnapshot>
} {
  const { search } = capture
  const { seatOrder } = capture.seats
  const snapshot = useAdventureSnapshot(
    'raid',
    seatOrder.map((slot) => slotAdventureName(search.slots[slot])),
    capture.startedRounds
  )
  const cards = toSlotCards({
    slots: search.slots,
    nicknames: capture.nicknames,
    manualSlots: search.manualSlots,
    recognizing: capture.recognizing,
    snapshotMarks: seatValuesToSlotOrder(seatOrder, snapshot.marks),
    screen: 'raid'
  })

  return { cards, snapshot }
}
