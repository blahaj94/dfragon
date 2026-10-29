import { slotAdventureName } from '../lib/adventure-snapshot'
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
    candidatePickers: search.candidatePickers
  })
  const clipboardText = toClipboardText({
    slots: search.slots,
    nicknames: capture.nicknames,
    seatOrder: search.slots.map((_, slot) => slot),
    rowSize: search.slots.length
  })

  return { cards, snapshot, clipboardText }
}
