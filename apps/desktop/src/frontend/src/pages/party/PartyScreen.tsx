import { useId } from 'react'
import * as stylex from '@stylexjs/stylex'
import { PartyHeader } from '../../components/PartyHeader'
import { useAdventureSnapshot } from '../../hooks/useAdventureSnapshot'
import type { PartyCapture } from '../../hooks/usePartyCapture'
import { slotAdventureName } from '../../lib/adventure-snapshot'
import { filledSlotCount, toSlotCards } from '../../lib/slot-cards'
import { PartyPage } from './PartyPage'
import { styles } from './PartyScreen.style'

/** 파티 화면이 파티 캡처에서 읽는 값 */
export type PartyScreenCapture = Pick<
  PartyCapture,
  | 'nicknames'
  | 'recognizing'
  | 'round'
  | 'startedRounds'
  | 'lastCompletedAt'
  | 'canStartCapture'
  | 'startRound'
> & {
  search: Pick<
    PartyCapture['search'],
    'slots' | 'manualSlots' | 'detailNotice' | 'lookupSlot' | 'openDetails'
  >
}

/**
 * 파티 화면. 파티 캡처 결과로 머리와 카드 네 장이 그릴 값을 계산해 조립한다. 모험단 순번 스냅샷은 이 화면이
 * 가진다. 공대를 보는 동안에도 카드 상태를 유지하도록 숨기기만 하고 그린 채 둔다.
 */
export function PartyScreen({
  capture,
  hidden,
  collapsed,
  onToggleCollapsed
}: {
  capture: PartyScreenCapture
  hidden: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
}): React.JSX.Element {
  const cardsId = useId()
  const { search } = capture
  const snapshot = useAdventureSnapshot(search.slots.map(slotAdventureName), capture.startedRounds)
  const cards = toSlotCards({
    slots: search.slots,
    nicknames: capture.nicknames,
    manualSlots: search.manualSlots,
    recognizing: capture.recognizing,
    snapshotMarks: snapshot.marks
  })

  return (
    <div hidden={hidden} {...stylex.props(styles.party)}>
      <PartyHeader
        notice={search.detailNotice}
        filledCount={filledSlotCount(cards)}
        lastCapturedAt={capture.lastCompletedAt}
        canCapture={capture.canStartCapture}
        onCapture={capture.startRound}
        snapshotActive={snapshot.active}
        snapshotRound={snapshot.round}
        onTakeSnapshot={snapshot.take}
        onClearSnapshot={snapshot.clear}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        controls={cardsId}
      />
      <PartyPage
        id={cardsId}
        collapsed={collapsed}
        resetKey={String(capture.round)}
        slots={cards}
        inputEnabled
        actions={search}
      />
    </div>
  )
}
