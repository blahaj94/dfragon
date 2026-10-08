import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMachine } from '@xstate/react'
import { waitFor } from 'xstate'
import { partyCaptureMachine, getCapturePhase } from '../lib/party-capture-machine'
import type { CapturePhase } from '../types/capture'
import { useCaptureSources } from './useCaptureSources'
import { usePartyRecognition, type RecognitionState } from './usePartyRecognition'
import { useCharacterSearch } from './useCharacterSearch'
import { isDnfCaptureSource } from '../lib/capture-presentation'

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
  recognitionStates: readonly RecognitionState[]
  round: number
  status: string
  selectSource: (sourceId: string) => void
  selectAndStartCapture: (sourceId: string) => Promise<void>
  refreshSources: () => void
  setIntervalSeconds: (seconds: number) => void
  startCapture: () => Promise<void>
  stopCapture: (nextStatus?: string) => void
}

export function usePartyCapture({
  identifyCharacters = false
}: { identifyCharacters?: boolean } = {}): PartyCapture {
  const intervalSecondsRef = useRef(3)
  const [round, setRound] = useState(0)
  const [intervalSeconds, setIntervalSecondsState] = useState(3)
  const stopRef = useRef<() => void>(() => {})
  const search = useCharacterSearch(() => stopRef.current())
  const observeOcr = identifyCharacters ? search.observeOcr : undefined
  const recognition = usePartyRecognition(search.observe, observeOcr)

  // actor 자체가 멈추기 전에 대기 중인 공개 명령의 완료도 알린다.
  useEffect(() => () => stopRef.current(), [])
  const [snapshot, send, actor] = useMachine(partyCaptureMachine, {
    input: {
      selectSource: (sourceId) => window.api.selectCaptureSource(sourceId),
      beginSearch: search.begin,
      readFrame: (captureId) => window.api.readCaptureFrame(captureId),
      endSearch: search.end,
      resetRecognition: () => {
        recognition.resetRecognition()
        setRound((current) => current + 1)
      },
      getIntervalMs: () => intervalSecondsRef.current * 1000,
      recognizePartyNicknames: recognition.recognizePartyNicknames
    }
  })
  const sources = useCaptureSources()
  const phase = getCapturePhase(snapshot)
  const autoAttemptedSource = useRef<string | null>(null)

  useEffect(() => {
    if (!identifyCharacters || !search.ready || snapshot.context.selectedSourceId.length > 0) {
      return
    }
    const games = sources.sources.filter(isDnfCaptureSource)
    if (games.length !== 1 || autoAttemptedSource.current === games[0].id) {
      return
    }
    autoAttemptedSource.current = games[0].id
    send({ type: 'SELECT', sourceId: games[0].id, autoStart: true, request: {} })
  }, [identifyCharacters, search.ready, send, snapshot.context.selectedSourceId, sources.sources])

  useEffect(() => {
    if (!identifyCharacters || window.desktopShortcut === undefined) {
      return
    }

    return window.desktopShortcut.onDesktopShortcut((shortcut) => {
      if (shortcut === 'restart-search') {
        send({ type: 'START', request: {} })
      }
    })
  }, [identifyCharacters, send])

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

  const sourceState = { ...sources }
  const starting = phase === 'starting' || (phase === 'selecting' && snapshot.context.autoStart)
  const selectedSourceId = snapshot.context.selectedSourceId
  const sourceRegistered =
    snapshot.context.selectedSourceId.length > 0 &&
    snapshot.context.selectedSourceId === snapshot.context.registeredSourceId

  return {
    ...sourceState,
    phase,
    starting,
    selectedSourceId,
    sourceRegistered,
    selectSource,
    selectAndStartCapture,
    search,
    retrySearch: search.retry,
    intervalSeconds,
    stableNicknames: recognition.stableNicknames,
    recognitionStates: recognition.recognitionStates,
    round,
    status: snapshot.context.status,
    setIntervalSeconds,
    startCapture,
    stopCapture
  }
}
