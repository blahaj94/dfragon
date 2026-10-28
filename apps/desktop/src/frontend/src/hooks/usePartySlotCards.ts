import { slotAdventureName } from '../lib/adventure-snapshot'
import { toSlotCards, type SlotCard } from '../lib/slot-cards'
import { useAdventureSnapshot } from './useAdventureSnapshot'
import type { PartyCapture } from './usePartyCapture'

export function usePartySlotCards(capture: PartyCapture): {
  cards: SlotCard[]
  snapshot: ReturnType<typeof useAdventureSnapshot>
} {
  const { search } = capture
  const snapshot = useAdventureSnapshot(
    'party',
    search.slots.map(slotAdventureName),
    capture.startedRounds
  )
  const cards = toSlotCards({
    slots: search.slots,
    nicknames: capture.nicknames,
    manualSlots: search.manualSlots,
    recognizing: capture.recognizing,
    snapshotMarks: snapshot.marks,
    pickers: search.candidatePickers
  })

  return { cards, snapshot }
}
