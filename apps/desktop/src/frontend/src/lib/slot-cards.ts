import type { SearchSlot } from '../../../preload/common/types/search'
import type { CardCharacter, SlotState } from '../types/cards'
import type { SnapshotMark } from './adventure-snapshot'
import type { CandidatePicker } from './candidate-picker'
import type { SearchMode } from '../types/search-mode'
import { searchSlotNotice, toCharacterCard } from './character-card'

const NEXT_LOOKUP_STEP = 'Alt+R로 다시 인식하거나 서버와 이름을 직접 조회해 주세요.'

export type SlotCard = {
  state: SlotState
  character?: CardCharacter
  nickname?: string
  notice?: string
  loading?: boolean
  snapshotMark?: SnapshotMark
  picker?: CandidatePicker
  scorePending?: boolean
}

export type SlotCardActions = {
  lookupSlot: (slot: number, nickname: string, serverId: string) => void
  pickCandidate: (slot: number, serverId: string) => void
}

export function toSlotCards({
  slots,
  nicknames,
  manualSlots,
  recognizing,
  snapshotMarks,
  candidatePickers = [],
  screen = 'party'
}: {
  slots: readonly SearchSlot[]
  nicknames: readonly (string | null)[]
  manualSlots: readonly boolean[]
  recognizing: boolean
  snapshotMarks: readonly (SnapshotMark | undefined)[]
  candidatePickers?: readonly (CandidatePicker | null)[]
  screen?: SearchMode
}): SlotCard[] {
  return slots.map((slot, index) => {
    const character = toCharacterCard(slot.selected)
    const nickname = nicknames[index] ?? undefined
    const notice = searchSlotNotice(slot, NEXT_LOOKUP_STEP, screen)
    const loading = !manualSlots[index] && recognizing
    const picker = candidatePickers[index] ?? undefined
    const scorePending = slot.details === 'pending'

    return {
      state: slot.state,
      character,
      nickname,
      notice,
      loading,
      snapshotMark: snapshotMarks[index],
      picker,
      scorePending
    }
  })
}

export function filledSlotCount(cards: readonly SlotCard[]): number {
  return cards.filter((card) => card.state === 'success' && card.character != null).length
}
