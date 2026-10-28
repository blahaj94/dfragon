import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createCaptureSearch,
  type CaptureSearch,
  type OcrCaptureObservation
} from '../lib/capture-search'
import { emptySearchSlots } from '../lib/slots'
import type { SearchView } from '../types/search'
import type {
  OcrSearchObservation,
  SearchApi,
  SearchCommandResult,
  SearchSlotCount
} from '../../../preload/common/types/search'

export function useManualCharacterLookup(
  api: SearchApi | undefined,
  slotCount: SearchSlotCount,
  notifyOcr?: (observation: OcrSearchObservation) => Promise<SearchCommandResult>
): {
  view: SearchView
  startingSlots: readonly boolean[]
  bridge: React.RefObject<CaptureSearch | null>
  lookup: (slot: number, nickname: string, serverId: string) => void
  beginRound: (signal: AbortSignal) => Promise<string | null>
  observeOcr: (input: OcrCaptureObservation) => void
  reset: () => void
} {
  const bridge = useRef<CaptureSearch | null>(null)
  const session = useRef<{ controller: AbortController; starting: Promise<string | null> } | null>(
    null
  )
  const revisions = useRef(Array.from({ length: slotCount }, () => 0))
  const [startingSlots, setStartingSlots] = useState(() =>
    Array.from({ length: slotCount }, () => false)
  )
  const [view, setView] = useState<SearchView>(() => ({
    ready: false,
    slots: emptySearchSlots(slotCount),
    retryPending: Array.from({ length: slotCount }, () => false),
    connectionFailed: false
  }))

  const reset = useCallback(() => {
    session.current?.controller.abort()
    session.current = null
    revisions.current = Array.from({ length: slotCount }, () => 0)
    setStartingSlots(Array.from({ length: slotCount }, () => false))
    bridge.current?.end()
  }, [slotCount])

  useEffect(() => {
    if (api === undefined) {
      return
    }
    const connection = createCaptureSearch({
      api,
      notifyOcr,
      onChange: setView,
      onInvalidated: reset,
      slotCount
    })
    bridge.current = connection
    connection.connect()

    return () => {
      reset()
      bridge.current = null
      connection.dispose()
    }
  }, [api, notifyOcr, reset, slotCount])

  // 캡처 회차는 수명을 새로 시작해 모든 슬롯을 비우고, 그 뒤의 서버 지정 조회도 회차의 수명을 쓴다. 회차가
  // 취소되면 그 시작을 버리고 다음 조회가 수명을 다시 시작한다.
  const beginRound = useCallback(
    (signal: AbortSignal): Promise<string | null> => {
      const connection = bridge.current
      if (connection === null) {
        return Promise.resolve(null)
      }
      session.current?.controller.abort()
      revisions.current = Array.from({ length: slotCount }, () => 0)
      setStartingSlots(Array.from({ length: slotCount }, () => false))
      const controller = new AbortController()
      const starting = connection.begin({ signal: controller.signal })
      const current = { controller, starting }
      session.current = current
      signal.addEventListener(
        'abort',
        () => {
          // 시작을 기다리던 조회는 버려지므로 진행 표시도 거둔다.
          if (session.current === current) {
            session.current = null
            setStartingSlots(Array.from({ length: slotCount }, () => false))
          }
          controller.abort()
        },
        { once: true }
      )

      return starting
    },
    [slotCount]
  )

  const observeOcr = useCallback((input: OcrCaptureObservation): void => {
    bridge.current?.observe(input)
  }, [])

  const lookup = useCallback(
    (slot: number, nickname: string, serverId: string) => {
      const connection = bridge.current
      if (connection === null) {
        return
      }

      if (session.current === null) {
        const controller = new AbortController()
        const starting = connection.begin({ signal: controller.signal })
        session.current = { controller, starting }
      }
      const current = session.current
      const revision = ++revisions.current[slot]
      setStartingSlots((slots) => slots.map((pending, index) => index === slot || pending))
      void current.starting
        .then((captureId) => {
          if (
            session.current !== current ||
            current.controller.signal.aborted ||
            revisions.current[slot] !== revision
          ) {
            return
          }

          if (captureId === null) {
            reset()
            setView((previous) => ({ ...previous, connectionFailed: true }))

            return
          }
          connection.lookup({ slot, nickname, serverId })
          setStartingSlots((slots) => slots.map((pending, index) => index !== slot && pending))
        })
        .catch(() => {
          if (session.current === current) {
            reset()
            setView((previous) => ({ ...previous, connectionFailed: true }))
          }
        })
    },
    [reset]
  )

  return { view, startingSlots, bridge, lookup, beginRound, observeOcr, reset }
}
