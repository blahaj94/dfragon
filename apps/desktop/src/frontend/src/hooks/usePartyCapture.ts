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

type PartyCapture = {
  search: ReturnType<typeof useCharacterSearch>
  retrySearch: (slot: number) => void
  phase: CapturePhase
  recognizing: boolean
  sources: { id: string; name: string }[]
  selectedSourceId: string
  /** 창 등록을 마쳐 회차가 프레임을 읽을 수 있는 상태인지. 공대 캡처도 이 등록을 쓴다. */
  sourceReady: boolean
  canStartCapture: boolean
  sourcesLoading: boolean
  sourcesFailed: boolean
  nicknames: (string | null)[]
  round: number
  /** 지금까지 시작한 회차 수. 실패하거나 취소된 회차도 센다. */
  startedRounds: number
  status: string
  /** 마지막으로 인식을 마친 회차의 완료 시각(ms). 없으면 null이다. */
  lastCompletedAt: number | null
  /** Alt+R과 같은 회차 시작. 받을 수 없는 상태에서는 Alt+R처럼 아무 일도 하지 않는다. */
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
  /** 파티 화면이 보일 때만 Alt+R을 받는다. 공대 화면에서는 공대 캡처가 받는다. */
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

  // Alt+R과 파티 머리의 캡처 버튼이 같은 START를 보낸다. 받을 수 없는 상태의 거절과 진행 중 재시작은
  // 둘 다 machine이 정한다.
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
  // 회차를 받는 상태(창 등록 뒤, 회차 진행과 실패 뒤)는 main에 창이 등록된 상태다. 중지 뒤에는 다시 골라야 한다.
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
