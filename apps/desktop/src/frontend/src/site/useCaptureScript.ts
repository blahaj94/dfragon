import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useSlotCardStore } from '../hooks/useSlotCardStore'
import type { CapturePhase } from '../types/capture'
import type { SearchMode } from '../types/search-mode'

const FIRST_CAPTURE_DELAY_MS = 1000
const FILL_INTERVAL_MS: Record<SearchMode, number> = { party: 350, raid: 150 }
const SLOT_COUNTS: Record<SearchMode, number> = { party: 4, raid: 12 }

const CANDIDATE_CARD_ID = 'party-0'

export type ScriptBoard = { filled: number; round: number }

export function useCaptureScript(mode: SearchMode): {
  boards: Record<SearchMode, ScriptBoard>
  phase: CapturePhase
  lastCaptureAt: number | null
  capture: () => void
} {
  const [boards, setBoards] = useState<Record<SearchMode, ScriptBoard>>({
    party: { filled: 0, round: 0 },
    raid: { filled: SLOT_COUNTS.raid, round: 1 }
  })
  const [phase, setPhase] = useState<CapturePhase>('selected')
  const [lastCaptureAt, setLastCaptureAt] = useState<number | null>(null)
  const timers = useRef<number[]>([])

  function clearTimers(): void {
    for (const timer of timers.current) {
      window.clearTimeout(timer)
    }
    timers.current = []
  }

  function fillSlot(target: SearchMode, round: number, slot: number): void {
    // 실제 앱은 동명이인 후보가 있으면 후보 창을 바로 연다. 목업은 1번 카드의 후보 칩을 눌러 열도록 카드가
    // 채워지는 같은 렌더에서 닫힌 상태로 둔다. 카드가 비어 있는 동안 닫아 두면 후보 창 hook이 다시 연다.
    if (target === 'party' && slot === 1) {
      useSlotCardStore
        .getState()
        .updateSlotCard(
          { id: CANDIDATE_CARD_ID, resetKey: String(round) },
          { candidatesClosed: true }
        )
    }
    setBoards((current) => ({ ...current, [target]: { filled: slot, round } }))
    if (slot === SLOT_COUNTS[target]) {
      setPhase('complete')
      setLastCaptureAt(Date.now())
    }
  }

  function startCapture(target: SearchMode): void {
    clearTimers()
    const round = boards[target].round + 1
    setPhase('recognizing')
    setBoards((current) => ({ ...current, [target]: { filled: 0, round } }))
    for (let slot = 1; slot <= SLOT_COUNTS[target]; slot += 1) {
      const delay = FILL_INTERVAL_MS[target] * slot
      timers.current.push(window.setTimeout(() => fillSlot(target, round, slot), delay))
    }
  }

  const captureFirst = useEffectEvent(() => startCapture('party'))

  useEffect(() => {
    // 첫 자동 캡처도 같은 목록에 두어, 그 전에 누른 캡처가 시작되면 자동 캡처를 취소한다.
    timers.current.push(window.setTimeout(() => captureFirst(), FIRST_CAPTURE_DELAY_MS))

    return () => {
      for (const pending of timers.current) {
        window.clearTimeout(pending)
      }
    }
  }, [])

  const capture = (): void => startCapture(mode)

  return { boards, phase, lastCaptureAt, capture }
}
