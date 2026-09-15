import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CaptureSearch, emptySearchSlots, type SearchView } from './capture-search'

type CharacterSearch = SearchView & {
  begin: (signal: AbortSignal) => Promise<string | null>
  end: () => void
  observe: (input: { slot: number; nickname: string | null }) => void
  retry: (slot: number) => void
}

export function useCharacterSearch(onInvalidated: () => void): CharacterSearch {
  const invalidatedRef = useRef(onInvalidated)
  useLayoutEffect(() => {
    invalidatedRef.current = onInvalidated
  }, [onInvalidated])
  const bridgeRef = useRef<CaptureSearch | null>(null)
  const [view, setView] = useState<SearchView>({
    ready: false,
    slots: emptySearchSlots(),
    retryPending: [false, false, false, false],
    connectionFailed: false
  })
  const api = window.search
  const notify = window.api.notifyStableNicknameDetected

  useEffect(() => {
    let active = true
    const bridge = new CaptureSearch({
      api,
      notify,
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
  }, [api, notify])

  const begin = useCallback(async (signal: AbortSignal): Promise<string | null> => {
    const bridge = bridgeRef.current
    if (bridge == null) {
      return null
    }
    return bridge.begin({ signal })
  }, [])
  const end = useCallback((): void => bridgeRef.current?.end(), [])
  const observe = useCallback((input: { slot: number; nickname: string | null }): void => {
    bridgeRef.current?.observe(input)
  }, [])
  const retry = useCallback((slot: number): void => {
    void bridgeRef.current?.retry(slot)
  }, [])
  return { ...view, begin, end, observe, retry }
}
