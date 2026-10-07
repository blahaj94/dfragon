import { useCallback, useEffect, useRef, useState } from 'react'
import { createCaptureSearch, type CaptureSearch } from '../lib/capture-search'
import { emptySearchSlots } from '../lib/slots'
import type { SearchView } from '../types/search'

/** 게임 캡처가 없어도 실행할 수 있는 서버 지정 조회의 연결과 요청 수명을 소유한다. */
export function useManualCharacterLookup(): {
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
  const revisions = useRef([0, 0, 0, 0])
  const [startingSlots, setStartingSlots] = useState([false, false, false, false])
  const [view, setView] = useState<SearchView>({
    ready: false,
    slots: emptySearchSlots(),
    retryPending: [false, false, false, false],
    connectionFailed: false
  })
  const api = window.manualSearch

  const reset = useCallback(() => {
    session.current?.controller.abort()
    session.current = null
    revisions.current = [0, 0, 0, 0]
    setStartingSlots([false, false, false, false])
    bridge.current?.end()
  }, [])

  useEffect(() => {
    if (api === undefined) {
      return
    }
    const connection = createCaptureSearch({
      api,
      notify: api.notifyManualNickname,
      onChange: setView,
      onInvalidated: reset
    })
    bridge.current = connection
    connection.connect()

    return () => {
      reset()
      bridge.current = null
      connection.dispose()
    }
  }, [api, reset])

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
