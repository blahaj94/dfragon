import { createPortal } from 'react-dom'
import * as stylex from '@stylexjs/stylex'
import { BoardHeader } from '../../components/BoardHeader'
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
    'slots' | 'manualSlots' | 'lookupSlot' | 'candidatePickers' | 'pickCandidate'
  >
}

/**
 * 파티 화면. 파티 캡처 결과로 머리와 카드 네 장이 그릴 값을 계산해 조립한다. 모험단 순번 스냅샷은 이 화면이
 * 가진다. 공대를 보는 동안에도 카드 상태를 유지하도록 숨기기만 하고 그린 채 두며, 머리는 보이는 동안만
 * 상단 바의 머리 자리에 그린다.
 */
export function PartyScreen({
  capture,
  hidden,
  headerSlot
}: {
  capture: PartyScreenCapture
  hidden: boolean
  /** 상단 바의 화면 머리 자리. 아직 그려지지 않았으면 null이다. */
  headerSlot: HTMLElement | null
}): React.JSX.Element {
  const { search } = capture
  const snapshot = useAdventureSnapshot(search.slots.map(slotAdventureName), capture.startedRounds)
  const cards = toSlotCards({
    slots: search.slots,
    nicknames: capture.nicknames,
    manualSlots: search.manualSlots,
    recognizing: capture.recognizing,
    snapshotMarks: snapshot.marks,
    pickers: search.candidatePickers
  })

  return (
    <div hidden={hidden} {...stylex.props(styles.party)}>
      {!hidden &&
        headerSlot != null &&
        createPortal(
          <BoardHeader
            target="파티"
            filledCount={filledSlotCount(cards)}
            notice=""
            capture={capture}
            snapshot={snapshot}
          />,
          headerSlot
        )}
      <PartyPage resetKey={String(capture.round)} slots={cards} inputEnabled actions={search} />
    </div>
  )
}
