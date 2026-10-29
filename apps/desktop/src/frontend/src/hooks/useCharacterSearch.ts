import { useCallback, useEffectEvent, useState } from 'react'
import type { OcrCaptureObservation } from '../lib/capture-search'
import {
  nextCandidatePick,
  toCandidatePicker,
  type CandidatePick,
  type CandidatePicker
} from '../lib/candidate-picker'
import type { SearchView } from '../types/search'
import { SEARCH_SLOT_COUNTS } from '../../../preload/common/types/search'
import { useManualCharacterLookup } from './useManualCharacterLookup'

type CharacterSearch = SearchView & {
  begin: (signal: AbortSignal) => Promise<string | null>
  end: () => void
  observeOcr: (input: OcrCaptureObservation) => void
  manualSlots: readonly boolean[]
  lookupSlot: (slot: number, nickname: string, serverId: string) => void
  candidatePickers: readonly (CandidatePicker | null)[]
  pickCandidate: (slot: number, serverId: string) => void
}

function partySlotValues<T>(value: T): T[] {
  return Array.from({ length: SEARCH_SLOT_COUNTS.party }, () => value)
}

const DIRECT_LOOKUP_PICK: CandidatePick = { kind: 'confirmed', requestId: null }

/** 회차가 끝나면 직접 조회한 슬롯과 누른 후보까지 파티 네 슬롯을 모두 비운다. */
export function useCharacterSearch(onInvalidated: () => void): CharacterSearch {
  const {
    view,
    lookup,
    beginRound,
    observeOcr: observeLookupOcr,
    reset
  } = useManualCharacterLookup(
    window.search,
    SEARCH_SLOT_COUNTS.party,
    window.api.notifyOcrCandidatesDetected,
    onInvalidated
  )
  const [manualSlots, setManualSlots] = useState<readonly boolean[]>(() => partySlotValues(false))
  const [picks, setPicks] = useState<readonly (CandidatePick | null)[]>(() => partySlotValues(null))

  const end = useCallback((): void => {
    setManualSlots(partySlotValues(false))
    setPicks(partySlotValues(null))
    reset()
  }, [reset])
  const setPick = useCallback((slot: number, pick: CandidatePick | null): void => {
    setPicks((current) => current.map((value, index) => (index === slot ? pick : value)))
  }, [])
  // 캡처 machine은 처음 받은 함수를 계속 부르므로, 그 함수도 최신 수동 조회 슬롯을 읽어야 한다.
  const observeOcr = useEffectEvent((input: OcrCaptureObservation): void => {
    if (!manualSlots[input.slot]) {
      observeLookupOcr(input)
    }
  })
  const lookupManually = useCallback(
    (slot: number, nickname: string, serverId: string): void => {
      setManualSlots((slots) => slots.map((manual, index) => manual || index === slot))
      lookup(slot, nickname, serverId)
    },
    [lookup]
  )
  const lookupSlot = useCallback(
    (slot: number, nickname: string, serverId: string): void => {
      setPick(slot, DIRECT_LOOKUP_PICK)
      lookupManually(slot, nickname, serverId)
    },
    [lookupManually, setPick]
  )
  const pickCandidate = useCallback(
    (slot: number, serverId: string): void => {
      const current = view.slots[slot]
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
      lookupManually(slot, choice.characterName, serverId)
    },
    [lookupManually, picks, setPick, view.slots]
  )
  const candidatePickers = view.slots.map((slot, index) =>
    toCandidatePicker(slot, picks[index] ?? null)
  )
  // 미리보기 조회가 끝날 때까지는 대기 화면 대신 처음 누를 때 보이던 캐릭터를 둔다.
  const slots = view.slots.map((slot, index) => {
    const pick = picks[index]
    if (pick?.kind === 'preview' && slot.state === 'pending') {
      return pick.shownSlot
    }

    return slot
  })

  return {
    ...view,
    slots,
    begin: beginRound,
    end,
    observeOcr,
    manualSlots,
    lookupSlot,
    candidatePickers,
    pickCandidate
  }
}
