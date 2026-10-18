import { useCallback, useEffect, useRef, useState } from 'react'
import { createCaptureSearch, type CaptureSearch } from '../lib/capture-search'
import { emptySearchSlots } from '../lib/slots'
import type { SearchView } from '../types/search'
import type { SearchApi, SearchSlotCount } from '../../../preload/common/types/search'

/**
 * 게임 캡처가 없어도 실행할 수 있는 서버 지정 조회의 연결과 요청 수명을 소유한다. 파티 카드와 공대
 * 카드는 각자의 API와 슬롯 수로 이 hook을 따로 써서 서로의 자리를 덮어쓰지 않는다.
 */
export function useManualCharacterLookup(
  api: SearchApi | undefined,
  slotCount: SearchSlotCount
): {
  view: SearchView
  startingSlots: readonly boolean[]
  bridge: React.RefObject<CaptureSearch | null>
  lookup: (slot: number, nickname: string, serverId: string) => void
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
  }, [api, reset, slotCount])

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

  return { view, startingSlots, bridge, lookup, reset }
}
