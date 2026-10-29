import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMachine } from '@xstate/react'
import { partyCaptureMachine, getCapturePhase } from '../lib/party-capture-machine'
import type { CapturePhase } from '../types/capture'
import { useCaptureSources } from './useCaptureSources'
import { SEARCH_SLOT_COUNTS } from '../../../preload/common/types/search'
import { useCharacterSearch } from './useCharacterSearch'
import { findSingleDnfCaptureSource } from '../lib/capture-presentation'
import { getRecognizedNicknames } from '../lib/recognized-nicknames'
import { useDesktopShortcut } from './useDesktopShortcut'
import { createSharedOcrWorker, type OcrRecognition } from '../lib/ocr-worker-recognition'

export type CaptureSourceSelection = ReturnType<typeof useCaptureSources> & {
  selectedSourceId: string
  sourceReady: boolean
  selectSource: (sourceId: string) => void
}

export type PartyCapture = {
  source: CaptureSourceSelection
  search: ReturnType<typeof useCharacterSearch>
  phase: CapturePhase
  recognizing: boolean
  canStartCapture: boolean
  nicknames: (string | null)[]
  round: number
  startedRounds: number
  status: string
  lastCompletedAt: number | null
  recognizeWithOcr: OcrRecognition
  startRound: () => void
  stopCapture: () => void
}

export function usePartyCapture({ receivesShortcut }: { receivesShortcut: boolean }): PartyCapture {
  const stopRef = useRef<() => void>(() => {})
  const search = useCharacterSearch(() => stopRef.current())
  const [ocrWorker] = useState(createSharedOcrWorker)

  // actor 자체가 멈추기 전에 대기 중인 공개 명령의 완료도 알린다.
  useEffect(() => () => stopRef.current(), [])
  const [snapshot, send] = useMachine(partyCaptureMachine, {
    input: {
      selectSource: (sourceId) => window.api.selectCaptureSource(sourceId),
      beginSearch: search.begin,
      readFrame: (captureId) => window.api.readCaptureFrame(captureId),
      endSearch: search.end,
      observeOcr: search.observeOcr,
      recognizeWithOcr: ocrWorker.recognize
    }
  })
  const sources = useCaptureSources()
  const phase = getCapturePhase(snapshot)
  const canAutoSelect = snapshot.matches('idle')
  const autoAttemptedSource = useRef<string | null>(null)

  useEffect(() => {
    if (!search.ready || !canAutoSelect) {
      return
    }
    const game = findSingleDnfCaptureSource(sources.sources)
    if (game === null || autoAttemptedSource.current === game.id) {
      return
    }
    autoAttemptedSource.current = game.id
    send({ type: 'SELECT', sourceId: game.id })
  }, [search.ready, canAutoSelect, send, sources.sources])

  const startRound = useCallback(() => send({ type: 'START' }), [send])
  useDesktopShortcut('restart-search', receivesShortcut, startRound)

  function stopCapture(): void {
    send({ type: 'STOP' })
  }
  useLayoutEffect(() => {
    stopRef.current = stopCapture
  })

  function selectSource(sourceId: string): void {
    send({ type: 'SELECT', sourceId })
  }

  const recognizing = phase === 'recognizing'
  const nicknames = getRecognizedNicknames(snapshot.context.results, SEARCH_SLOT_COUNTS.party)
  const selectedSourceId = snapshot.context.selectedSourceId
  const canStartCapture = snapshot.can({ type: 'START' })
  const sourceReady =
    snapshot.matches('selected') ||
    snapshot.matches('capturing') ||
    snapshot.matches('captureFailed')

  // 등록한 창에서 첫 회차가 모델 로드를 기다리지 않도록 미리 띄우고, 창 변경, 중지 때 정리한다.
  useEffect(() => {
    if (!sourceReady) {
      return
    }
    ocrWorker.prepare()

    return () => ocrWorker.release()
  }, [ocrWorker, sourceReady])

  const source: CaptureSourceSelection = {
    ...sources,
    selectedSourceId,
    sourceReady,
    selectSource
  }

  return {
    source,
    phase,
    recognizing,
    canStartCapture,
    search,
    nicknames,
    round: snapshot.context.round,
    startedRounds: snapshot.context.startedRounds,
    status: snapshot.context.status,
    lastCompletedAt: snapshot.context.completedAt,
    recognizeWithOcr: ocrWorker.recognize,
    startRound,
    stopCapture
  }
}
