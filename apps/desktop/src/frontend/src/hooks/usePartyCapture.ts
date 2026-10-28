import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useMachine } from '@xstate/react'
import { waitFor } from 'xstate'
import { partyCaptureMachine, getCapturePhase } from '../lib/party-capture-machine'
import type { CapturePhase } from '../types/capture'
import { useCaptureSources } from './useCaptureSources'
import { PARTY_SLOT_COUNT } from '../constants/capture'
import { useCharacterSearch } from './useCharacterSearch'
import { isDnfCaptureSource } from '../lib/capture-presentation'
import { useRestartShortcut } from './useRestartShortcut'

export type PartyCapture = {
  search: ReturnType<typeof useCharacterSearch>
  retrySearch: (slot: number) => void
  phase: CapturePhase
  recognizing: boolean
  sources: { id: string; name: string }[]
  selectedSourceId: string
  sourceReady: boolean
  canStartCapture: boolean
  sourcesLoading: boolean
  sourcesFailed: boolean
  nicknames: (string | null)[]
  round: number
  startedRounds: number
  status: string
  lastCompletedAt: number | null
  startRound: () => void
  selectSource: (sourceId: string) => void
  refreshSources: () => void
  startCapture: () => Promise<void>
  stopCapture: (nextStatus?: string) => void
}

export function usePartyCapture({
  identifyCharacters = false,
  receivesShortcut = true
}: {
  identifyCharacters?: boolean
  receivesShortcut?: boolean
} = {}): PartyCapture {
  const stopRef = useRef<() => void>(() => {})
  const search = useCharacterSearch(() => stopRef.current())
  const observeOcr = identifyCharacters ? search.observeOcr : undefined

  // actor 자체가 멈추기 전에 대기 중인 공개 명령의 완료도 알린다.
  useEffect(() => () => stopRef.current(), [])
  const [snapshot, send, actor] = useMachine(partyCaptureMachine, {
    input: {
      selectSource: (sourceId) => window.api.selectCaptureSource(sourceId),
      beginSearch: search.begin,
      readFrame: (captureId) => window.api.readCaptureFrame(captureId),
      endSearch: search.end,
      observe: search.observe,
      observeOcr
    }
  })
  const sources = useCaptureSources()
  const phase = getCapturePhase(snapshot)
  const canAutoSelect = snapshot.matches('idle')
  const autoAttemptedSource = useRef<string | null>(null)

  useEffect(() => {
    if (!identifyCharacters || !search.ready || !canAutoSelect) {
      return
    }
    const games = sources.sources.filter(isDnfCaptureSource)
    if (games.length !== 1 || autoAttemptedSource.current === games[0].id) {
      return
    }
    autoAttemptedSource.current = games[0].id
    send({ type: 'SELECT', sourceId: games[0].id })
  }, [identifyCharacters, search.ready, canAutoSelect, send, sources.sources])

  const startRound = useCallback(() => send({ type: 'START', request: {} }), [send])
  useRestartShortcut(identifyCharacters && receivesShortcut, startRound)

  function stopCapture(status?: string): void {
    send({ type: 'STOP', status })
  }
  useLayoutEffect(() => {
    stopRef.current = stopCapture
  })

  function selectSource(sourceId: string): void {
    send({ type: 'SELECT', sourceId })
  }

  async function startCapture(): Promise<void> {
    const request = {}
    send({ type: 'START', request })
    await waitFor(actor, (state) => state.context.request !== request || !state.hasTag('busy'))
  }

  const sourceState = { ...sources }
  const recognizing = phase === 'recognizing'
  const nicknames = Array.from({ length: PARTY_SLOT_COUNT }, (_, slot) => {
    const result = snapshot.context.results[slot]
    if (result == null || result.kind === 'missing' || result.kind === 'failed') {
      return null
    }

    if (!identifyCharacters) {
      const nickname = result.legacyNickname.length > 0 ? result.legacyNickname : null

      return nickname
    }

    if (result.kind === 'recognized') {
      return result.nickname
    }

    return null
  })
  const selectedSourceId = snapshot.context.selectedSourceId
  const canStartCapture = snapshot.can({ type: 'START', request: {} })
  const sourceReady =
    snapshot.matches('selected') ||
    snapshot.matches('capturing') ||
    snapshot.matches('captureFailed')

  return {
    ...sourceState,
    phase,
    recognizing,
    selectedSourceId,
    sourceReady,
    canStartCapture,
    selectSource,
    search,
    retrySearch: search.retry,
    nicknames,
    round: snapshot.context.round,
    startedRounds: snapshot.context.startedRounds,
    status: snapshot.context.status,
    lastCompletedAt: snapshot.context.completedAt,
    startRound,
    startCapture,
    stopCapture
  }
}
