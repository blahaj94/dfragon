import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  createCaptureSearch,
  type CaptureSearch,
  type CaptureObservation,
  type OcrCaptureObservation
} from '../lib/capture-search'
import { emptySearchSlots } from '../lib/slots'
import type { SearchView } from '../types/search'
import type { CharacterSelectionReference } from '../../../preload/common/types/character-detail'
import { useManualCharacterLookup } from './useManualCharacterLookup'

type CharacterSearch = SearchView & {
  begin: (signal: AbortSignal) => Promise<string | null>
  end: () => void
  observe: (input: { slot: number; nickname: string | null }) => void
  observeOcr: (input: OcrCaptureObservation) => void
  retry: (slot: number) => void
  openDetails: (slot: number) => void
  detailNotice: string
  manualSlots: readonly boolean[]
  editSlot: (slot: number) => void
  submitSlot: (slot: number, nickname: string) => void
  resumeOcr: (slot: number) => void
  lookupSlot: (slot: number, nickname: string, serverId: string) => void
}

export function useCharacterSearch(onInvalidated: () => void): CharacterSearch {
  const invalidatedRef = useRef(onInvalidated)
  useLayoutEffect(() => {
    invalidatedRef.current = onInvalidated
  }, [onInvalidated])
  const bridgeRef = useRef<CaptureSearch | null>(null)
  const {
    view: manualView,
    startingSlots: manualStartingSlots,
    bridge: manualBridge,
    lookup: manualLookup,
    reset: resetManual
  } = useManualCharacterLookup()
  const detailPendingRef = useRef(new Set<string>())
  const [detailFailure, setDetailFailure] = useState<CharacterSelectionReference | null>(null)
  const manualSlotsRef = useRef(new Set<number>())
  const serverLookupSlotsRef = useRef(new Set<number>())
  const [serverLookupSlots, setServerLookupSlots] = useState([false, false, false, false])
  const latestOcrRef = useRef<(CaptureObservation | null)[]>([null, null, null, null])
  const [manualSlots, setManualSlots] = useState<readonly boolean[]>([false, false, false, false])
  const [view, setView] = useState<SearchView>({
    ready: false,
    slots: emptySearchSlots(),
    retryPending: [false, false, false, false],
    connectionFailed: false
  })
  const api = window.search
  const notify = window.api.notifyStableNicknameDetected
  const notifyOcr = window.api.notifyOcrCandidatesDetected

  useEffect(() => {
    let active = true
    const pendingDetails = detailPendingRef.current
    const bridge = createCaptureSearch({
      api,
      notify,
      notifyOcr,
      onChange: (value) => {
        if (active) {
          setView(value)
          setDetailFailure((failure) => {
            if (failure === null) {
              return null
            }
            const activeBridge = serverLookupSlotsRef.current.has(failure.slot)
              ? manualBridge.current
              : bridgeRef.current
            const current = activeBridge?.selectedReference(failure.slot)
            if (
              current?.captureId === failure.captureId &&
              current.slot === failure.slot &&
              current.requestId === failure.requestId
            ) {
              return failure
            }

            return null
          })
        }
      },
      onInvalidated: () => invalidatedRef.current()
    })
    bridgeRef.current = bridge
    bridge.connect()

    return () => {
      active = false
      bridgeRef.current = null
      pendingDetails.clear()
      bridge.dispose()
    }
  }, [api, notify, notifyOcr, manualBridge])

  const begin = useCallback(async (signal: AbortSignal): Promise<string | null> => {
    const bridge = bridgeRef.current
    if (bridge == null) {
      return null
    }

    return bridge.begin({ signal })
  }, [])
  const end = useCallback((): void => {
    setDetailFailure(null)
    manualSlotsRef.current.clear()
    serverLookupSlotsRef.current.clear()
    setServerLookupSlots([false, false, false, false])
    latestOcrRef.current = [null, null, null, null]
    setManualSlots([false, false, false, false])
    resetManual()
    bridgeRef.current?.end()
  }, [resetManual])
  const observe = useCallback((input: CaptureObservation): void => {
    latestOcrRef.current[input.slot] = input
    if (!manualSlotsRef.current.has(input.slot)) {
      bridgeRef.current?.observe(input)
    }
  }, [])
  const editSlot = useCallback((slot: number): void => {
    serverLookupSlotsRef.current.delete(slot)
    setServerLookupSlots((slots) => slots.map((value, index) => index !== slot && value))
    manualSlotsRef.current.add(slot)
    setManualSlots([0, 1, 2, 3].map((index) => manualSlotsRef.current.has(index)))
    // Clear also cancels the old request before a manual draft can be submitted.
    bridgeRef.current?.observe({ slot, nickname: null })
  }, [])
  const submitSlot = useCallback((slot: number, nickname: string): void => {
    if (manualSlotsRef.current.has(slot)) {
      bridgeRef.current?.observe({ slot, nickname: null })
      bridgeRef.current?.observe({ slot, nickname })
    }
  }, [])
  const resumeOcr = useCallback((slot: number): void => {
    serverLookupSlotsRef.current.delete(slot)
    setServerLookupSlots((slots) => slots.map((value, index) => index !== slot && value))
    manualSlotsRef.current.delete(slot)
    setManualSlots([0, 1, 2, 3].map((index) => manualSlotsRef.current.has(index)))
    bridgeRef.current?.observe({ slot, nickname: null })
    const latestOcr = latestOcrRef.current[slot]
    if (latestOcr != null) {
      bridgeRef.current?.observe(latestOcr)
    }
  }, [])
  const retry = useCallback(
    (slot: number): void => {
      const bridge = serverLookupSlotsRef.current.has(slot)
        ? manualBridge.current
        : bridgeRef.current
      void bridge?.retry(slot)
    },
    [manualBridge]
  )
  const lookupSlot = useCallback(
    (slot: number, nickname: string, serverId: string): void => {
      manualSlotsRef.current.add(slot)
      setManualSlots([0, 1, 2, 3].map((index) => manualSlotsRef.current.has(index)))
      setDetailFailure(null)
      serverLookupSlotsRef.current.add(slot)
      setServerLookupSlots((slots) => slots.map((value, index) => index === slot || value))
      manualLookup(slot, nickname, serverId)
    },
    [manualLookup]
  )
  const openDetails = useCallback(
    (slot: number): void => {
      const bridge = serverLookupSlotsRef.current.has(slot)
        ? manualBridge.current
        : bridgeRef.current
      const reference = bridge?.selectedReference(slot)
      if (bridge == null || reference == null) {
        return
      }
      const identity = `${reference.captureId}:${reference.slot}:${reference.requestId}`
      if (detailPendingRef.current.has(identity)) {
        return
      }
      detailPendingRef.current.add(identity)
      setDetailFailure(null)
      const reportFailure = (): void => {
        const current = bridge.selectedReference(slot)
        if (
          (serverLookupSlotsRef.current.has(slot) ? manualBridge.current : bridgeRef.current) ===
            bridge &&
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
    [manualBridge]
  )
  const detailNotice =
    detailFailure === null ? '' : '캐릭터 정보 창을 열지 못했습니다. 다시 시도해 주세요.'
  const slots = view.slots.map((slot) => {
    if (serverLookupSlots[slot.slot]) {
      if (manualStartingSlots[slot.slot]) {
        const state = 'pending' as const

        return { ...manualView.slots[slot.slot], state }
      }

      return manualView.slots[slot.slot]
    }

    return slot
  })
  const connectionFailed = view.connectionFailed || manualView.connectionFailed
  const retryPending = view.retryPending.map((pending, slot) => {
    if (serverLookupSlots[slot]) {
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
    observe,
    observeOcr: observe,
    retry,
    openDetails,
    detailNotice,
    manualSlots,
    editSlot,
    submitSlot,
    resumeOcr,
    lookupSlot
  }
}
