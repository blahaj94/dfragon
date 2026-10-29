import { useCallback, useState } from 'react'
import { fillSlots } from '../lib/slots'
import {
  nextCandidatePick,
  toCandidatePicker,
  type CandidatePick,
  type CandidatePicker
} from '../lib/candidate-picker'
import { SEARCH_SLOT_COUNTS } from '../../../preload/common/types/search'
import { useManualCharacterLookup, type ManualCharacterLookup } from './useManualCharacterLookup'

type CharacterSearch = ManualCharacterLookup & {
  candidatePickers: readonly (CandidatePicker | null)[]
  pickCandidate: (slot: number, serverId: string) => void
}

const DIRECT_LOOKUP_PICK: CandidatePick = { kind: 'confirmed', requestId: null }

/** 회차가 끝나면 직접 조회한 슬롯과 누른 후보까지 파티 네 슬롯을 모두 비운다. */
export function useCharacterSearch(onInvalidated: () => void): CharacterSearch {
  const search = useManualCharacterLookup(
    window.search,
    SEARCH_SLOT_COUNTS.party,
    window.api.notifyOcrCandidatesDetected,
    onInvalidated
  )
  const { end: endSearch, lookupSlot: lookup } = search
  const [picks, setPicks] = useState<readonly (CandidatePick | null)[]>(() =>
    fillSlots(SEARCH_SLOT_COUNTS.party, null)
  )

  const end = useCallback((): void => {
    setPicks(fillSlots(SEARCH_SLOT_COUNTS.party, null))
    endSearch()
  }, [endSearch])
  const setPick = useCallback((slot: number, pick: CandidatePick | null): void => {
    setPicks((current) => current.map((value, index) => (index === slot ? pick : value)))
  }, [])
  const lookupSlot = useCallback(
    (slot: number, nickname: string, serverId: string): void => {
      setPick(slot, DIRECT_LOOKUP_PICK)
      lookup(slot, nickname, serverId)
    },
    [lookup, setPick]
  )
  const pickCandidate = useCallback(
    (slot: number, serverId: string): void => {
      const current = search.slots[slot]
      const previous = picks[slot]
      const next = nextCandidatePick(current, previous, serverId)
      if (next === null) {
        return
      }
      const shownServerId = toCandidatePicker(current, previous)?.shownServerId
      setPick(slot, next)
      const choice =
        next.kind === 'preview'
          ? next.choices.find((candidate) => candidate.serverId === serverId)
          : undefined
      if (choice === undefined || shownServerId === serverId) {
        return
      }
      lookup(slot, choice.characterName, serverId)
    },
    [lookup, picks, setPick, search.slots]
  )
  const candidatePickers = search.slots.map((slot, index) =>
    toCandidatePicker(slot, picks[index] ?? null)
  )
  // 미리보기 조회가 끝날 때까지는 대기 화면 대신 처음 누를 때 보이던 캐릭터를 둔다.
  const slots = search.slots.map((slot, index) => {
    const pick = picks[index]
    if (pick?.kind === 'preview' && slot.state === 'pending') {
      return pick.shownSlot
    }

    return slot
  })

  return {
    ...search,
    slots,
    end,
    lookupSlot,
    candidatePickers,
    pickCandidate
  }
}
