import { createPortal } from 'react-dom'
import * as stylex from '@stylexjs/stylex'
import { BoardHeader } from '../../components/BoardHeader'
import { useAdventureSnapshot } from '../../hooks/useAdventureSnapshot'
import type { PartyCapture } from '../../hooks/usePartyCapture'
import { slotAdventureName } from '../../lib/adventure-snapshot'
import { filledSlotCount, toSlotCards } from '../../lib/slot-cards'
import { PartyPage } from './PartyPage'
import { styles } from './PartyScreen.style'

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

export function PartyScreen({
  capture,
  hidden,
  headerSlot
}: {
  capture: PartyScreenCapture
  hidden: boolean
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
