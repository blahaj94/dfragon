import { useCallback, useEffectEvent, useState } from 'react'
import { SEARCH_SLOT_COUNTS, type SearchSlot } from '../../../preload/common/types/search'
import type { OcrCaptureObservation } from '../lib/capture-search'
import { useManualCharacterLookup } from './useManualCharacterLookup'

type RaidSearch = {
  slots: readonly SearchSlot[]
  connectionFailed: boolean
  /** 이번 회차가 시작된 뒤 사용자가 서버와 이름으로 조회한 슬롯. 회차의 OCR 결과가 덮지 않는다. */
  manualSlots: readonly boolean[]
  lookupSlot: (slot: number, nickname: string, serverId: string) => void
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
    lookup,
    beginRound: beginLookupRound,
    observeOcr: observeLookupOcr
  } = useManualCharacterLookup(
    window.raidSearch,
    SEARCH_SLOT_COUNTS.raid,
    window.raidSearch.notifyOcrCandidatesDetected
  )
  const [manualSlots, setManualSlots] = useState<readonly boolean[]>(emptyManualSlots)

  const lookupSlot = useCallback(
    (slot: number, nickname: string, serverId: string): void => {
      setManualSlots((slots) => slots.map((manual, index) => manual || index === slot))
      lookup(slot, nickname, serverId)
    },
    [lookup]
  )
  const beginRound = useCallback(
    (signal: AbortSignal): Promise<string | null> => {
      setManualSlots(emptyManualSlots())

      return beginLookupRound(signal)
    },
    [beginLookupRound]
  )
  // 회차 진행 중 사용자가 직접 조회한 슬롯은 늦게 끝난 OCR 결과로 바꾸지 않는다. 캡처 machine은 처음
  // 받은 함수를 계속 부르므로, 그 함수도 최신 수동 조회 슬롯을 읽어야 한다.
  const observeOcr = useEffectEvent((input: OcrCaptureObservation): void => {
    if (!manualSlots[input.slot]) {
      observeLookupOcr(input)
    }
  })

  return {
    slots: view.slots,
    connectionFailed: view.connectionFailed,
    manualSlots,
    lookupSlot,
    beginRound,
    observeOcr
  }
}
