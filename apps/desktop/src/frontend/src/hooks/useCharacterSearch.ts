import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import {
  createCaptureSearch,
  type CaptureSearch,
  type OcrCaptureObservation
} from '../lib/capture-search'
import { emptySearchSlots } from '../lib/slots'
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
  retry: (slot: number) => void
  manualSlots: readonly boolean[]
  lookupSlot: (slot: number, nickname: string, serverId: string) => void
  candidatePickers: readonly (CandidatePicker | null)[]
  pickCandidate: (slot: number, serverId: string) => void
}

function partySlotValues<T>(value: T): T[] {
  return Array.from({ length: SEARCH_SLOT_COUNTS.party }, () => value)
}

function toConfirmedPick(requestId: string | null, serverId: string): CandidatePick | null {
  if (requestId !== null) {
    return { requestId, serverId, confirmed: true }
  }

  return null
}

export function useCharacterSearch(onInvalidated: () => void): CharacterSearch {
  const invalidatedRef = useRef(onInvalidated)
  useLayoutEffect(() => {
    invalidatedRef.current = onInvalidated
  }, [onInvalidated])
  const bridgeRef = useRef<CaptureSearch | null>(null)
  const {
    view: manualView,
    bridge: manualBridge,
    lookup: manualLookup,
    reset: resetManual
  } = useManualCharacterLookup(window.manualSearch, SEARCH_SLOT_COUNTS.party)
  const [manualSlots, setManualSlots] = useState<readonly boolean[]>(() => partySlotValues(false))
  const [picks, setPicks] = useState<readonly (CandidatePick | null)[]>(() => partySlotValues(null))
  const [view, setView] = useState<SearchView>(() => ({
    ready: false,
    slots: emptySearchSlots(),
    retryPending: partySlotValues(false),
    connectionFailed: false
  }))
  const api = window.search
  const notifyOcr = window.api.notifyOcrCandidatesDetected

  useEffect(() => {
    let active = true
    const bridge = createCaptureSearch({
      api,
      notifyOcr,
      onChange: (value) => {
        if (active) {
          setView(value)
        }
      },
      onInvalidated: () => invalidatedRef.current()
    })
    bridgeRef.current = bridge
    bridge.connect()

    return () => {
      active = false
      bridgeRef.current = null
      bridge.dispose()
    }
  }, [api, notifyOcr])

  const begin = useCallback(async (signal: AbortSignal): Promise<string | null> => {
    const bridge = bridgeRef.current
    if (bridge == null) {
      return null
    }

    return bridge.begin({ signal })
  }, [])
  const end = useCallback((): void => {
    setManualSlots(partySlotValues(false))
    setPicks(partySlotValues(null))
    resetManual()
    bridgeRef.current?.end()
  }, [resetManual])
  const setPick = useCallback((slot: number, pick: CandidatePick | null): void => {
    setPicks((current) => current.map((value, index) => (index === slot ? pick : value)))
  }, [])
  // 캡처 machine은 처음 받은 함수를 계속 부르므로, 그 함수도 최신 수동 조회 슬롯을 읽어야 한다.
  const observeOcr = useEffectEvent((input: OcrCaptureObservation): void => {
    if (!manualSlots[input.slot]) {
      bridgeRef.current?.observe(input)
    }
  })
  const retry = useCallback(
    (slot: number): void => {
      const bridge = manualSlots[slot] ? manualBridge.current : bridgeRef.current
      bridge?.retry(slot)
    },
    [manualBridge, manualSlots]
  )
  const lookupManually = useCallback(
    (slot: number, nickname: string, serverId: string): void => {
      setManualSlots((slots) => slots.map((manual, index) => manual || index === slot))
      manualLookup(slot, nickname, serverId)
    },
    [manualLookup]
  )
  const lookupSlot = useCallback(
    (slot: number, nickname: string, serverId: string): void => {
      setPick(slot, toConfirmedPick(view.slots[slot].requestId, serverId))
      lookupManually(slot, nickname, serverId)
    },
    [lookupManually, setPick, view.slots]
  )
  const pickCandidate = useCallback(
    (slot: number, serverId: string): void => {
      const captureSlot = view.slots[slot]
      const previous = picks[slot]
      const next = nextCandidatePick(captureSlot, previous, serverId)
      if (next === null) {
        return
      }
      const choice = captureSlot.choices?.find((candidate) => candidate.serverId === serverId)
      if (choice === undefined) {
        return
      }
      const shownServerId = toCandidatePicker(captureSlot, previous)?.shownServerId
      setPick(slot, next)
      if (next.confirmed || shownServerId === serverId) {
        return
      }
      lookupManually(slot, choice.characterName, serverId)
    },
    [lookupManually, picks, setPick, view.slots]
  )
  const candidatePickers = view.slots.map((slot, index) =>
    toCandidatePicker(slot, picks[index] ?? null)
  )
  const slots = view.slots.map((slot) => {
    if (manualSlots[slot.slot]) {
      const manualSlot = manualView.slots[slot.slot]
      if (manualSlot.state === 'pending' && candidatePickers[slot.slot]?.previewServerId != null) {
        return slot
      }

      return manualSlot
    }

    return slot
  })
  const connectionFailed = view.connectionFailed || manualView.connectionFailed
  const retryPending = view.retryPending.map((pending, slot) => {
    if (manualSlots[slot]) {
      return manualView.retryPending[slot]
    }

    return pending
  })

  return {
    ...view,
    slots,
    retryPending,
    connectionFailed,
    begin,
    end,
    observeOcr,
    retry,
    manualSlots,
    lookupSlot,
    candidatePickers,
    pickCandidate
  }
}
