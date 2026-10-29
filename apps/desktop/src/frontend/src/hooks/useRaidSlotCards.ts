import { RAID_PARTY_SIZE } from '../constants/cards'
import { slotAdventureName } from '../lib/adventure-snapshot'
import { seatValuesToSlotOrder } from '../lib/raid-seats'
import { toClipboardText } from '../lib/slot-clipboard'
import { toSlotCards, type SlotCard } from '../lib/slot-cards'
import { useAdventureSnapshot } from './useAdventureSnapshot'
import type { RaidCapture } from './useRaidCapture'

export function useRaidSlotCards(capture: RaidCapture): {
  cards: SlotCard[]
  snapshot: ReturnType<typeof useAdventureSnapshot>
  clipboardText: string
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
  const clipboardText = toClipboardText({
    slots: search.slots,
    nicknames: capture.nicknames,
    seatOrder,
    rowSize: RAID_PARTY_SIZE
  })

  return { cards, snapshot, clipboardText }
}
