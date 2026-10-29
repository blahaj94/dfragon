import { useCallback, useEffect, useState } from 'react'
import { useMachine } from '@xstate/react'
import { getRaidCapturePhase, raidCaptureMachine } from '../lib/raid-capture-machine'
import { SEARCH_SLOT_COUNTS } from '../../../preload/common/types/search'
import { getRecognizedNicknames } from '../lib/recognized-nicknames'
import { createSeatOrder, swapSeats as swapSeatOrder, type SeatOrder } from '../lib/raid-seats'
import { useManualCharacterLookup, type ManualCharacterLookup } from './useManualCharacterLookup'
import { useDesktopShortcut } from './useDesktopShortcut'

export type RaidCapture = {
  search: ManualCharacterLookup
  phase: ReturnType<typeof getRaidCapturePhase>
  recognizing: boolean
  nicknames: (string | null)[]
  round: number
  startedRounds: number
  status: string
  lastCompletedAt: number | null
  canStartCapture: boolean
  startRound: () => void
  seats: {
    seatOrder: SeatOrder
    canMoveSeats: boolean
    swapSeats: (from: number, to: number) => boolean
  }
}

/**
 * 공대 화면의 캡처 회차, 12자리 조회와 자리 배치를 묶는다. 게임 창 선택과 중지는 파티 캡처가 소유하며, 이
 * hook은 그 등록 상태를 공대 회차에 알린다.
 *
 * 자리 배치는 화면 자리에 놓인 검색 슬롯만 바꾸고 main 공대 검색 수명의 슬롯 번호는 그대로 둔다. 그래서
 * 맞바꾼 뒤에도 진행 중 조회와 늦은 응답은 같은 슬롯, 곧 옮겨 간 카드에 들어간다. 회차는 12자리를 비우고
 * 게임 화면의 행 순서대로 1~12번 자리를 채우므로 시작할 때 배치를 처음으로 되돌린다. 인식하는 동안 맞바꾸면
 * 아직 들어오지 않은 행의 이름이 사용자가 옮긴 자리와 어긋나므로, 회차가 인식을 마치거나 끝날 때까지
 * 맞바꾸지 않는다.
 */
export function useRaidCapture({
  sourceId,
  sourceReady,
  receivesShortcut
}: {
  receivesShortcut: boolean
  sourceId: string
  sourceReady: boolean
}): RaidCapture {
  // 파티 카드와 다른 main 검색 수명을 써서 파티 네 자리와 공대 12자리가 서로의 결과를 덮어쓰지 않는다.
  const search = useManualCharacterLookup(
    window.raidSearch,
    SEARCH_SLOT_COUNTS.raid,
    window.raidSearch.notifyOcrCandidatesDetected
  )
  const [seatOrder, setSeatOrder] = useState(createSeatOrder)
  const { begin: beginSearch } = search
  const beginRound = useCallback(
    (signal: AbortSignal): Promise<string | null> => {
      setSeatOrder(createSeatOrder())

      return beginSearch(signal)
    },
    [beginSearch]
  )
  const [snapshot, send] = useMachine(raidCaptureMachine, {
    input: {
      beginSearch: beginRound,
      readFrame: (captureId) => window.raidSearch.readCaptureFrame(captureId),
      observeOcr: search.observeOcr
    }
  })

  const registeredSourceId = sourceReady ? sourceId : null
  useEffect(() => {
    send({ type: 'SOURCE', sourceId: registeredSourceId })
  }, [send, registeredSourceId])

  const startRound = useCallback(() => send({ type: 'START' }), [send])
  useDesktopShortcut('restart-search', receivesShortcut, startRound)

  const phase = getRaidCapturePhase(snapshot)
  const recognizing = phase === 'recognizing'
  const nicknames = getRecognizedNicknames(snapshot.context.results, SEARCH_SLOT_COUNTS.raid)
  const canStartCapture = snapshot.can({ type: 'START' })
  const canMoveSeats = !recognizing
  const swapSeats = (from: number, to: number): boolean => {
    if (!canMoveSeats) {
      return false
    }
    const next = swapSeatOrder(seatOrder, from, to)
    if (next === seatOrder) {
      return false
    }
    setSeatOrder(next)

    return true
  }

  return {
    search,
    phase,
    recognizing,
    nicknames,
    round: snapshot.context.round,
    startedRounds: snapshot.context.startedRounds,
    status: snapshot.context.status,
    lastCompletedAt: snapshot.context.completedAt,
    canStartCapture,
    startRound,
    seats: { seatOrder, canMoveSeats, swapSeats }
  }
}
