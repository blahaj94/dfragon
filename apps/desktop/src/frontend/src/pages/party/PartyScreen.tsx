import * as stylex from '@stylexjs/stylex'
import { BoardHeader } from '../../components/BoardHeader'
import { useAdventureSnapshot } from '../../hooks/useAdventureSnapshot'
import { useBoardHeaderPortal } from '../../hooks/useBoardHeaderPortal'
import { useScreenCaptureContext } from '../../hooks/useScreenCaptureContext'
import { slotAdventureName } from '../../lib/adventure-snapshot'
import { filledSlotCount, toSlotCards } from '../../lib/slot-cards'
import { PartyPage } from './PartyPage'
import { styles } from './PartyScreen.style'

export function PartyScreen({ hidden }: { hidden: boolean }): React.JSX.Element {
  const { partyCapture: capture } = useScreenCaptureContext()
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
  const { renderBoardHeader } = useBoardHeaderPortal()

  return (
    <div hidden={hidden} {...stylex.props(styles.party)}>
      {!hidden &&
        renderBoardHeader(
          <BoardHeader
            target="파티"
            filledCount={filledSlotCount(cards)}
            notice=""
            capture={capture}
            snapshot={snapshot}
          />
        )}
      <PartyPage resetKey={String(capture.round)} slots={cards} inputEnabled actions={search} />
    </div>
  )
}
