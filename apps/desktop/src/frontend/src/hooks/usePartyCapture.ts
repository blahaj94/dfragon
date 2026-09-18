import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMachine } from '@xstate/react'
import { waitFor } from 'xstate'
import { partyCaptureMachine, getCapturePhase } from '../lib/party-capture-machine'
import type { CapturePhase } from '../types/capture'
import { useCaptureSources } from './useCaptureSources'
import { usePartyRecognition } from './usePartyRecognition'
import { useCharacterSearch } from './useCharacterSearch'

type PartyCapture = {
  search: ReturnType<typeof useCharacterSearch>
  retrySearch: (slot: number) => void
  phase: CapturePhase
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
  const intervalSecondsRef = useRef(3)
  const [intervalSeconds, setIntervalSecondsState] = useState(3)
  const stopRef = useRef<() => void>(() => {})
  const search = useCharacterSearch(() => stopRef.current())
  const recognition = usePartyRecognition(search.observe)

  // actor 자체가 멈추기 전에 대기 중인 공개 명령의 완료도 알린다.
  useEffect(() => () => stopRef.current(), [])
  const [snapshot, send, actor] = useMachine(partyCaptureMachine, {
    input: {
      selectSource: (sourceId) => window.api.selectCaptureSource(sourceId),
      beginSearch: search.begin,
      endSearch: search.end,
      resetRecognition: recognition.resetRecognition,
      getIntervalMs: () => intervalSecondsRef.current * 1000,
      recognizePartyNicknames: recognition.recognizePartyNicknames
    }
  })
  const setStatus = useCallback((status: string) => send({ type: 'NOTICE', status }), [send])
  const sources = useCaptureSources(setStatus)
  const phase = getCapturePhase(snapshot)

  function stopCapture(status?: string): void {
    send({ type: 'STOP', status })
  }
  useLayoutEffect(() => {
    stopRef.current = stopCapture
  })

  function selectSource(sourceId: string): void {
    send({ type: 'SELECT', sourceId, autoStart: false, request: {} })
  }

  async function selectAndStartCapture(sourceId: string): Promise<void> {
    const request = {}
    send({ type: 'SELECT', sourceId, autoStart: true, request })
    await waitFor(actor, (state) => state.context.request !== request || !state.hasTag('busy'))
  }

  async function startCapture(): Promise<void> {
    const request = {}
    send({ type: 'START', request })
    await waitFor(actor, (state) => state.context.request !== request || !state.hasTag('busy'))
  }

  function setIntervalSeconds(seconds: number): void {
    intervalSecondsRef.current = seconds
    setIntervalSecondsState(seconds)
  }

  return {
    ...sources,
    phase,
    starting: phase === 'starting' || (phase === 'selecting' && snapshot.context.autoStart),
    selectedSourceId: snapshot.context.selectedSourceId,
    sourceRegistered:
      snapshot.context.selectedSourceId.length > 0 &&
      snapshot.context.selectedSourceId === snapshot.context.registeredSourceId,
    selectSource,
    selectAndStartCapture,
    search,
    retrySearch: search.retry,
    intervalSeconds,
    stableNicknames: recognition.stableNicknames,
    status: snapshot.context.status,
    setIntervalSeconds,
    startCapture,
    stopCapture
  }
}
