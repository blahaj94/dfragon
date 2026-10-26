import { useCallback, useRef, useState } from 'react'
import { SEARCH_SLOT_COUNTS, type SearchSlot } from '../../../preload/common/types/search'
import type { OcrCaptureObservation } from '../lib/capture-search'
import { useManualCharacterLookup } from './useManualCharacterLookup'

type RaidSearch = {
  slots: readonly SearchSlot[]
  connectionFailed: boolean
  /** 이번 회차가 시작된 뒤 사용자가 서버와 이름으로 조회한 자리. 회차의 OCR 결과가 덮지 않는다. */
  manualSlots: readonly boolean[]
  lookupSlot: (slot: number, nickname: string, serverId: string) => void
  /** 공대 캡처 회차를 위해 공대 수명을 새로 시작한다. 12자리와 직접 조회 표시를 비운다. */
  beginRound: (signal: AbortSignal) => Promise<string | null>
  observeOcr: (input: OcrCaptureObservation) => void
}

const emptyManualSlots = (): boolean[] =>
  Array.from({ length: SEARCH_SLOT_COUNTS.raid }, () => false)

/**
 * 공대 12자리의 서버 지정 조회와 공대 캡처의 이름 식별을 소유한다. 파티 카드와 다른 main
 * 검색 수명을 써서 파티 네 자리와 공대 12자리가 서로의 결과를 덮어쓰지 않는다.
 */
export function useRaidSearch(): RaidSearch {
  const {
    view,
    startingSlots,
    lookup,
    beginRound: beginLookupRound,
    observeOcr: observeLookupOcr
  } = useManualCharacterLookup(
    window.raidSearch,
    SEARCH_SLOT_COUNTS.raid,
    window.raidSearch?.notifyOcrCandidatesDetected
  )
  const manualSlotsRef = useRef(new Set<number>())
  const [manualSlots, setManualSlots] = useState<readonly boolean[]>(emptyManualSlots)

  const lookupSlot = useCallback(
    (slot: number, nickname: string, serverId: string): void => {
      manualSlotsRef.current.add(slot)
      setManualSlots((slots) => slots.map((manual, index) => manual || index === slot))
      lookup(slot, nickname, serverId)
    },
    [lookup]
  )
  const beginRound = useCallback(
    (signal: AbortSignal): Promise<string | null> => {
      manualSlotsRef.current.clear()
      setManualSlots(emptyManualSlots())

      return beginLookupRound(signal)
    },
    [beginLookupRound]
  )
  // 회차 진행 중 사용자가 직접 조회한 자리는 늦게 끝난 OCR 결과로 바꾸지 않는다.
  const observeOcr = useCallback(
    (input: OcrCaptureObservation): void => {
      if (!manualSlotsRef.current.has(input.slot)) {
        observeLookupOcr(input)
      }
    },
    [observeLookupOcr]
  )
  // 서버 연결을 기다리는 자리는 main snapshot이 오기 전에도 진행 표시를 보인다.
  const slots = view.slots.map((slot) => {
    if (startingSlots[slot.slot]) {
      const state = 'pending' as const

      return { ...slot, state }
    }

    return slot
  })

  return {
    slots,
    connectionFailed: view.connectionFailed,
    manualSlots,
    lookupSlot,
    beginRound,
    observeOcr
  }
}
