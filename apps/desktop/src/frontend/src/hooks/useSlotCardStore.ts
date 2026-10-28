import { create } from 'zustand'

export type SlotCardKey = { id: string; resetKey: string }

export type StoredLookupDraft = {
  name: string
  serverId: string
  dirty: boolean
  submitted: { nickname: string; serverId: string } | null
  inputNotice: string
  source: { name: string | undefined; serverId: string | undefined }
}

type SlotCardState = {
  lookupDraft?: StoredLookupDraft
  candidatesClosed?: boolean
}

const EMPTY_SLOT_CARD_STATE: SlotCardState = {}

export const useSlotCardStore = create<{
  cards: Record<string, SlotCardState & { resetKey: string }>
  updateSlotCard: (key: SlotCardKey, patch: SlotCardState) => void
}>()((set) => ({
  cards: {},
  updateSlotCard: (key, patch) =>
    set(({ cards }) => {
      const current = cards[key.id]
      const base = current?.resetKey === key.resetKey ? current : { resetKey: key.resetKey }

      return { cards: { ...cards, [key.id]: { ...base, ...patch } } }
    })
}))

export function useSlotCardState(key: SlotCardKey): SlotCardState {
  return useSlotCardStore((state) => {
    const card = state.cards[key.id]
    if (card?.resetKey !== key.resetKey) {
      return EMPTY_SLOT_CARD_STATE
    }

    return card
  })
}
