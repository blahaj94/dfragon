import { useCallback, useEffect, useState } from 'react'
import { useMachine } from '@xstate/react'
import { getRaidCapturePhase, raidCaptureMachine } from '../lib/raid-capture-machine'
import { SEARCH_SLOT_COUNTS } from '../../../preload/common/types/search'
import { createSeatOrder, swapSeats, type SeatOrder } from '../lib/raid-seats'
import { useRaidSearch } from './useRaidSearch'
import { useRestartShortcut } from './useRestartShortcut'

type RaidCapture = {
  search: ReturnType<typeof useRaidSearch>
  phase: ReturnType<typeof getRaidCapturePhase>
  recognizing: boolean
  /** 화면 순서대로 인식한 12행 공대원 이름. 인식하지 못한 자리는 null이다. */
  nicknames: (string | null)[]
  round: number
  status: string
  /** 마지막으로 인식을 마친 공대 회차의 완료 시각(ms). 없으면 null이다. */
  lastCompletedAt: number | null
  canStartCapture: boolean
  /** Alt+R과 같은 공대 회차 시작. 창이 등록되지 않았거나 받을 수 없는 상태에서는 아무 일도 하지 않는다. */
  startRound: () => void
  /** 화면 자리 0~11에 놓인 공대 검색 슬롯 */
  seatOrder: SeatOrder
  /** 공대 회차가 인식하는 동안은 자리를 맞바꾸지 않는다. */
  canMoveSeats: boolean
  /** 두 화면 자리를 맞바꾼다. 맞바꿀 수 없는 동안에는 아무 일도 하지 않는다. */
  swapSeats: (from: number, to: number) => void
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
  /** 공대 화면이 보일 때만 Alt+R을 받는다. */
  receivesShortcut: boolean
  /** 파티 캡처가 main에 등록한 게임 창. 바뀌면 진행 중 회차를 취소한다. */
  sourceId: string
  /** 창 등록을 마쳐 프레임을 읽을 수 있는 상태인지 */
  sourceReady: boolean
}): RaidCapture {
  const search = useRaidSearch()
  const [seatOrder, setSeatOrder] = useState(createSeatOrder)
  const { beginRound: beginSearchRound } = search
  const beginRound = useCallback(
    (signal: AbortSignal): Promise<string | null> => {
      setSeatOrder(createSeatOrder())

      return beginSearchRound(signal)
    },
    [beginSearchRound]
  )
  const [snapshot, send] = useMachine(raidCaptureMachine, {
    input: {
      beginSearch: beginRound,
      readFrame: (captureId) => window.raidSearch.readCaptureFrame(captureId),
      observeOcr: search.observeOcr
    }
  })

  // 창 변경, 중지, 개발 도구 진입처럼 파티 캡처의 창 등록이 바뀌면 machine이 진행 중인 공대 회차를 끝낸다.
  const registeredSourceId = sourceReady ? sourceId : null
  useEffect(() => {
    send({ type: 'SOURCE', sourceId: registeredSourceId })
  }, [send, registeredSourceId])

  const startRound = useCallback(() => send({ type: 'START' }), [send])
  useRestartShortcut(receivesShortcut, startRound)

  const phase = getRaidCapturePhase(snapshot)
  const recognizing = phase === 'recognizing'
  const nicknames = Array.from({ length: SEARCH_SLOT_COUNTS.raid }, (_, slot) => {
    const result = snapshot.context.results[slot]
    if (result?.kind === 'recognized') {
      return result.nickname
    }

    return null
  })
  const canStartCapture = snapshot.can({ type: 'START' })
  const canMoveSeats = !recognizing
  const moveSeats = (from: number, to: number): void => {
    if (canMoveSeats) {
      setSeatOrder((order) => swapSeats(order, from, to))
    }
  }

  return {
    search,
    phase,
    recognizing,
    nicknames,
    round: snapshot.context.round,
    status: snapshot.context.status,
    lastCompletedAt: snapshot.context.completedAt,
    canStartCapture,
    startRound,
    seatOrder,
    canMoveSeats,
    swapSeats: moveSeats
  }
}
