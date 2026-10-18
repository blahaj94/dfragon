import { useCallback, useRef, useState } from 'react'
import { SEARCH_SLOT_COUNTS, type SearchSlot } from '../../../preload/common/types/search'
import type { CharacterSelectionReference } from '../../../preload/common/types/character-detail'
import type { OcrCaptureObservation } from '../lib/capture-search'
import { useManualCharacterLookup } from './useManualCharacterLookup'

type RaidSearch = {
  slots: readonly SearchSlot[]
  connectionFailed: boolean
  detailNotice: string
  /** 이번 회차가 시작된 뒤 사용자가 서버와 이름으로 조회한 자리. 회차의 OCR 결과가 덮지 않는다. */
  manualSlots: readonly boolean[]
  lookupSlot: (slot: number, nickname: string, serverId: string) => void
  openDetails: (slot: number) => void
  /** 공대 캡처 회차를 위해 공대 수명을 새로 시작한다. 12자리와 직접 조회 표시를 비운다. */
  beginRound: (signal: AbortSignal) => Promise<string | null>
  observeOcr: (input: OcrCaptureObservation) => void
}

const emptyManualSlots = (): boolean[] =>
  Array.from({ length: SEARCH_SLOT_COUNTS.raid }, () => false)

/**
 * 공대 12자리의 서버 지정 조회, 공대 캡처의 이름 식별과 상세 창 열기를 소유한다. 파티 카드와 다른 main
 * 검색 수명을 써서 파티 네 자리와 공대 12자리가 서로의 결과를 덮어쓰지 않는다.
 */
export function useRaidSearch(): RaidSearch {
  const {
    view,
    startingSlots,
    bridge,
    lookup,
    beginRound: beginLookupRound,
    observeOcr: observeLookupOcr
  } = useManualCharacterLookup(
    window.raidSearch,
    SEARCH_SLOT_COUNTS.raid,
    window.raidSearch?.notifyOcrCandidatesDetected
  )
  const detailPendingRef = useRef(new Set<string>())
  const [detailFailure, setDetailFailure] = useState<CharacterSelectionReference | null>(null)
  const manualSlotsRef = useRef(new Set<number>())
  const [manualSlots, setManualSlots] = useState<readonly boolean[]>(emptyManualSlots)

  const lookupSlot = useCallback(
    (slot: number, nickname: string, serverId: string): void => {
      setDetailFailure(null)
      manualSlotsRef.current.add(slot)
      setManualSlots((slots) => slots.map((manual, index) => manual || index === slot))
      lookup(slot, nickname, serverId)
    },
    [lookup]
  )
  const beginRound = useCallback(
    (signal: AbortSignal): Promise<string | null> => {
      setDetailFailure(null)
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
  const openDetails = useCallback(
    (slot: number): void => {
      const connection = bridge.current
      const reference = connection?.selectedReference(slot)
      if (connection == null || reference == null) {
        return
      }
      const identity = `${reference.captureId}:${reference.slot}:${reference.requestId}`
      if (detailPendingRef.current.has(identity)) {
        return
      }
      detailPendingRef.current.add(identity)
      setDetailFailure(null)
      // 창을 여는 동안 그 자리를 다시 조회했다면 이전 캐릭터의 실패를 새 결과에 보이지 않는다.
      const reportFailure = (): void => {
        const current = connection.selectedReference(slot)
        if (
          bridge.current === connection &&
          current?.captureId === reference.captureId &&
          current.requestId === reference.requestId
        ) {
          setDetailFailure(reference)
        }
      }
      void window.api
        .openCharacterDetails(reference)
        .then((result) => {
          if (!result.ok) {
            reportFailure()
          }
        })
        .catch(reportFailure)
        .finally(() => detailPendingRef.current.delete(identity))
    },
    [bridge]
  )
  // 서버 연결을 기다리는 자리는 main snapshot이 오기 전에도 진행 표시를 보인다.
  const slots = view.slots.map((slot) => {
    if (startingSlots[slot.slot]) {
      const state = 'pending' as const

      return { ...slot, state }
    }

    return slot
  })
  const failedSlot = detailFailure === null ? undefined : view.slots[detailFailure.slot]
  const failureCurrent =
    failedSlot?.state === 'success' && failedSlot.requestId === detailFailure?.requestId
  const detailNotice = failureCurrent ? '캐릭터 정보 창을 열지 못했습니다. 다시 시도해 주세요.' : ''

  return {
    slots,
    connectionFailed: view.connectionFailed,
    detailNotice,
    manualSlots,
    lookupSlot,
    openDetails,
    beginRound,
    observeOcr
  }
}
