import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  createCaptureSearch,
  type CaptureSearch,
  type OcrCaptureObservation
} from '../lib/capture-search'
import { emptySearchSlots, fillSlots } from '../lib/slots'
import type { SearchView } from '../types/search'
import type {
  OcrSearchObservation,
  SearchApi,
  SearchCommandResult,
  SearchSlotCount
} from '../../../preload/common/types/search'

export type ManualCharacterLookup = SearchView & {
  lookupSlot: (slot: number, nickname: string, serverId: string) => void
  begin: (signal: AbortSignal) => Promise<string | null>
  end: () => void
  observeOcr: (input: OcrCaptureObservation) => void
}

export function useManualCharacterLookup(
  api: SearchApi,
  slotCount: SearchSlotCount,
  notifyOcr: (observation: OcrSearchObservation) => Promise<SearchCommandResult>,
  /** Main이 수명을 끝냈을 때 연결을 비운 뒤 부른다. */
  onInvalidated?: () => void
): ManualCharacterLookup {
  const bridge = useRef<CaptureSearch | null>(null)
  const [view, setView] = useState<SearchView>(() => ({
    ready: false,
    slots: emptySearchSlots(slotCount),
    manualSlots: fillSlots(slotCount, false),
    connectionFailed: false
  }))

  const notifyInvalidated = useEffectEvent(() => onInvalidated?.())

  useEffect(() => {
    const connection = createCaptureSearch({
      api,
      notifyOcr,
      onChange: setView,
      onInvalidated: () => notifyInvalidated(),
      slotCount
    })
    bridge.current = connection
    connection.connect()

    return () => {
      bridge.current = null
      connection.dispose()
    }
  }, [api, notifyOcr, slotCount])

  // effect가 연결을 다시 만들어도 캡처 machine은 처음 받은 함수를 계속 부르므로, 함수는 지금 연결을 읽는다.
  const begin = useCallback((signal: AbortSignal): Promise<string | null> => {
    const connection = bridge.current
    if (connection === null) {
      return Promise.resolve(null)
    }

    return connection.begin({ signal })
  }, [])
  const end = useCallback((): void => {
    bridge.current?.end()
  }, [])
  const observeOcr = useCallback((input: OcrCaptureObservation): void => {
    bridge.current?.observe(input)
  }, [])
  const lookupSlot = useCallback((slot: number, nickname: string, serverId: string): void => {
    bridge.current?.lookup({ slot, nickname, serverId })
  }, [])

  return { ...view, lookupSlot, begin, end, observeOcr }
}
