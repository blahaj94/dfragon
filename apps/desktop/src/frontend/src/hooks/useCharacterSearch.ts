import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  createCaptureSearch,
  type CaptureSearch,
  type CaptureObservation,
  type OcrCaptureObservation
} from '../lib/capture-search'
import { emptySearchSlots } from '../lib/slots'
import type { SearchView } from '../types/search'

type CharacterSearch = SearchView & {
  begin: (signal: AbortSignal) => Promise<string | null>
  end: () => void
  observe: (input: { slot: number; nickname: string | null }) => void
  observeOcr: (input: OcrCaptureObservation) => void
  retry: (slot: number) => void
  manualSlots: readonly boolean[]
  editSlot: (slot: number) => void
  submitSlot: (slot: number, nickname: string) => void
  resumeOcr: (slot: number) => void
}

export function useCharacterSearch(onInvalidated: () => void): CharacterSearch {
  const invalidatedRef = useRef(onInvalidated)
  useLayoutEffect(() => {
    invalidatedRef.current = onInvalidated
  }, [onInvalidated])
  const bridgeRef = useRef<CaptureSearch | null>(null)
  const manualSlotsRef = useRef(new Set<number>())
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
    const bridge = createCaptureSearch({
      api,
      notify,
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
  }, [api, notify, notifyOcr])

  const begin = useCallback(async (signal: AbortSignal): Promise<string | null> => {
    const bridge = bridgeRef.current
    if (bridge == null) {
      return null
    }

    return bridge.begin({ signal })
  }, [])
  const end = useCallback((): void => {
    manualSlotsRef.current.clear()
    latestOcrRef.current = [null, null, null, null]
    setManualSlots([false, false, false, false])
    bridgeRef.current?.end()
  }, [])
  const observe = useCallback((input: CaptureObservation): void => {
    latestOcrRef.current[input.slot] = input
    if (!manualSlotsRef.current.has(input.slot)) {
      bridgeRef.current?.observe(input)
    }
  }, [])
  const editSlot = useCallback((slot: number): void => {
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
    manualSlotsRef.current.delete(slot)
    setManualSlots([0, 1, 2, 3].map((index) => manualSlotsRef.current.has(index)))
    bridgeRef.current?.observe({ slot, nickname: null })
    const latestOcr = latestOcrRef.current[slot]
    if (latestOcr != null) {
      bridgeRef.current?.observe(latestOcr)
    }
  }, [])
  const retry = useCallback((slot: number): void => {
    void bridgeRef.current?.retry(slot)
  }, [])

  return {
    ...view,
    begin,
    end,
    observe,
    observeOcr: observe,
    retry,
    manualSlots,
    editSlot,
    submitSlot,
    resumeOcr
  }
}
