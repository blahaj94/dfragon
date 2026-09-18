import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useCaptureSourceSelection } from './useCaptureSourceSelection'
import { usePartyCaptureSession } from './usePartyCaptureSession'
import { usePartyRecognition } from './usePartyRecognition'
import { useCharacterSearch } from './useCharacterSearch'

type PartyCapture = {
  search: ReturnType<typeof useCharacterSearch>
  retrySearch: (slot: number) => void
  starting: boolean
  sources: { id: string; name: string }[]
  selectedSourceId: string
  sourceRegistered: boolean
  sourcesLoading: boolean
  sourcesFailed: boolean
  intervalSeconds: number
  stableNicknames: (string | null)[]
  status: string
  selectSource: (sourceId: string) => void
  selectAndStartCapture: (sourceId: string) => Promise<void>
  refreshSources: () => void
  setIntervalSeconds: (seconds: number) => void
  startCapture: () => Promise<void>
  stopCapture: (nextStatus?: string) => void
}

export function usePartyCapture(): PartyCapture {
  const selectionRequestRef = useRef(0)
  const [selectionPending, setSelectionPending] = useState(false)
  const intervalSecondsRef = useRef(3)
  const [intervalSeconds, setIntervalSecondsState] = useState(3)
  const [status, setStatus] = useState('캡처할 게임 창을 선택해 주세요.')
  const { isSelectedSourceRegistered, cancelPendingSelection, ...sourceSelection } =
    useCaptureSourceSelection(setStatus)
  const stopRef = useRef<() => void>(() => {})
  const search = useCharacterSearch(() => stopRef.current())
  const recognition = usePartyRecognition(search.observe)
  const captureSession = usePartyCaptureSession({
    isSelectedSourceRegistered,
    beginSearch: search.begin,
    endSearch: search.end,
    intervalSecondsRef,
    setStatus,
    recognizePartyNicknames: recognition.recognizePartyNicknames,
    resetRecognition: recognition.resetRecognition
  })

  function stopCapture(nextStatus?: string): void {
    selectionRequestRef.current += 1
    cancelPendingSelection()
    setSelectionPending(false)
    captureSession.stopCapture(nextStatus)
  }

  useLayoutEffect(() => {
    stopRef.current = stopCapture
  })

  useEffect(
    () => () => {
      selectionRequestRef.current += 1
    },
    []
  )

  function selectSource(sourceId: string): void {
    stopCapture()
    void sourceSelection.selectSource(sourceId)
  }

  async function selectAndStartCapture(sourceId: string): Promise<void> {
    stopCapture()
    const request = selectionRequestRef.current
    setSelectionPending(sourceId.length > 0)
    try {
      const registered = await sourceSelection.selectSource(sourceId)
      if (registered && request === selectionRequestRef.current) {
        await captureSession.startCapture()
      }
    } finally {
      if (request === selectionRequestRef.current) {
        setSelectionPending(false)
      }
    }
  }

  function setIntervalSeconds(seconds: number): void {
    intervalSecondsRef.current = seconds
    setIntervalSecondsState(seconds)
  }

  return {
    ...sourceSelection,
    selectSource,
    selectAndStartCapture,
    search,
    retrySearch: search.retry,
    intervalSeconds,
    stableNicknames: recognition.stableNicknames,
    status,
    setIntervalSeconds,
    ...captureSession,
    starting: selectionPending || captureSession.starting,
    stopCapture
  }
}
