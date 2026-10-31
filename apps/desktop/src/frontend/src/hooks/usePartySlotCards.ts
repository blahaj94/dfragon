import { slotAdventureName } from '../lib/adventure-snapshot'
import { seatValuesToSlotOrder } from '../lib/seats'
import { toClipboardText } from '../lib/slot-clipboard'
import { toSlotCards, type SlotCard } from '../lib/slot-cards'
import { useAdventureSnapshot } from './useAdventureSnapshot'
import type { PartyCapture } from './usePartyCapture'

export function usePartySlotCards(capture: PartyCapture): {
  cards: SlotCard[]
  snapshot: ReturnType<typeof useAdventureSnapshot>
  clipboardText: string
} {
  const { search } = capture
  const { seatOrder } = capture.seats
  const snapshot = useAdventureSnapshot(
    'party',
    seatOrder.map((slot) => slotAdventureName(search.slots[slot])),
    capture.startedRounds
  )
  const cards = toSlotCards({
    slots: search.slots,
    nicknames: capture.nicknames,
    manualSlots: search.manualSlots,
    recognizing: capture.recognizing,
    snapshotMarks: seatValuesToSlotOrder(seatOrder, snapshot.marks),
    snapshotAdventureInputs: seatValuesToSlotOrder(seatOrder, snapshot.adventureInputs),
    candidatePickers: search.candidatePickers
  })
  const clipboardText = toClipboardText({
    slots: search.slots,
    nicknames: capture.nicknames,
    seatOrder,
    rowSize: search.slots.length
  })

  return { cards, snapshot, clipboardText }
}
