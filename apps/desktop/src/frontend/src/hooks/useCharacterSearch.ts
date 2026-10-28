import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  } = useManualCharacterLookup(window.manualSearch, SEARCH_SLOT_COUNTS.party)
  const manualSlotsRef = useRef(new Set<number>())
  const serverLookupSlotsRef = useRef(new Set<number>())
  const [serverLookupSlots, setServerLookupSlots] = useState([false, false, false, false])
  const [manualSlots, setManualSlots] = useState<readonly boolean[]>([false, false, false, false])
  const picksRef = useRef<(CandidatePick | null)[]>([null, null, null, null])
  const [picks, setPicks] = useState<readonly (CandidatePick | null)[]>([null, null, null, null])
  const [view, setView] = useState<SearchView>({
    ready: false,
    slots: emptySearchSlots(),
    retryPending: [false, false, false, false],
    connectionFailed: false
  })
  const viewRef = useRef(view)
  useLayoutEffect(() => {
    viewRef.current = view
  }, [view])
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
    manualSlotsRef.current.clear()
    serverLookupSlotsRef.current.clear()
    setServerLookupSlots([false, false, false, false])
    setManualSlots([false, false, false, false])
    picksRef.current = [null, null, null, null]
    setPicks(picksRef.current)
    resetManual()
    bridgeRef.current?.end()
  }, [resetManual])
  const setPick = useCallback((slot: number, pick: CandidatePick | null): void => {
    picksRef.current = picksRef.current.map((current, index) => (index === slot ? pick : current))
    setPicks(picksRef.current)
  }, [])
  const observeOcr = useCallback((input: OcrCaptureObservation): void => {
    if (!manualSlotsRef.current.has(input.slot)) {
      bridgeRef.current?.observe(input)
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
  const lookupManually = useCallback(
    (slot: number, nickname: string, serverId: string): void => {
      manualSlotsRef.current.add(slot)
      setManualSlots([0, 1, 2, 3].map((index) => manualSlotsRef.current.has(index)))
      serverLookupSlotsRef.current.add(slot)
      setServerLookupSlots((slots) => slots.map((value, index) => index === slot || value))
      manualLookup(slot, nickname, serverId)
    },
    [manualLookup]
  )
  const lookupSlot = useCallback(
    (slot: number, nickname: string, serverId: string): void => {
      const requestId = viewRef.current.slots[slot]?.requestId ?? null
      const pick = requestId === null ? null : { requestId, serverId, confirmed: true }
      setPick(slot, pick)
      lookupManually(slot, nickname, serverId)
    },
    [lookupManually, setPick]
  )
  const pickCandidate = useCallback(
    (slot: number, serverId: string): void => {
      const captureSlot = viewRef.current.slots[slot]
      const previous = picksRef.current[slot]
      const next = nextCandidatePick(captureSlot, previous, serverId)
      const choice = captureSlot.choices?.find((candidate) => candidate.serverId === serverId)
      if (next === null || choice === undefined) {
        return
      }
      const shownServerId = toCandidatePicker(captureSlot, previous)?.shownServerId
      setPick(slot, next)
      if (!next.confirmed && shownServerId !== serverId) {
        lookupManually(slot, choice.characterName, serverId)
      }
    },
    [lookupManually, setPick]
  )
  const candidatePickers = view.slots.map((slot, index) =>
    toCandidatePicker(slot, picks[index] ?? null)
  )
  const slots = view.slots.map((slot) => {
    if (serverLookupSlots[slot.slot]) {
      const manualSlot = manualView.slots[slot.slot]
      const loading = manualStartingSlots[slot.slot] || manualSlot.state === 'pending'
      if (loading && candidatePickers[slot.slot]?.previewServerId != null) {
        return slot
      }

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
    observeOcr,
    retry,
    manualSlots,
    lookupSlot,
    candidatePickers,
    pickCandidate
  }
}
