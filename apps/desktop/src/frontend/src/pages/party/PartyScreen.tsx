import * as stylex from '@stylexjs/stylex'
import { BoardHeader } from '../../components/BoardHeader'
import { BoardNotice } from '../../components/BoardNotice'
import { BoardTitle } from '../../components/BoardTitle'
import { CaptureButton } from '../../components/CaptureButton'
import { LastCaptureTime } from '../../components/LastCaptureTime'
import { SnapshotToggle } from '../../components/SnapshotToggle'
import { useBoardHeaderPortal } from '../../hooks/useBoardHeaderPortal'
import { usePartySlotCards } from '../../hooks/usePartySlotCards'
import { useScreenCaptureContext } from '../../hooks/useScreenCaptureContext'
import { filledSlotCount } from '../../lib/slot-cards'
import { PartyPage } from './PartyPage'
import { styles } from './PartyScreen.style'

export function PartyScreen({ hidden }: { hidden: boolean }): React.JSX.Element {
  const { partyCapture: capture } = useScreenCaptureContext()
  const { cards, snapshot } = usePartySlotCards(capture)
  const { renderBoardHeader } = useBoardHeaderPortal()

  return (
    <div hidden={hidden} {...stylex.props(styles.party)}>
      {!hidden &&
        renderBoardHeader(
          <BoardHeader
            start={
              <>
                <BoardTitle
                  label="파티"
                  filled={filledSlotCount(cards)}
                  total={cards.length}
                  round={snapshot.round}
                />
                <BoardNotice />
              </>
            }
            end={
              <>
                <LastCaptureTime at={capture.lastCompletedAt} />
                <SnapshotToggle
                  label="파티 모험단 순번 스냅샷"
                  active={snapshot.active}
                  onTake={snapshot.take}
                  onClear={snapshot.clear}
                />
                <CaptureButton
                  target="파티"
                  disabled={!capture.canStartCapture}
                  onClick={capture.startRound}
                />
              </>
            }
          />
        )}
      <PartyPage
        resetKey={String(capture.round)}
        slots={cards}
        inputEnabled
        actions={{
          lookupSlot: capture.search.lookupSlot,
          pickCandidate: capture.search.pickCandidate
        }}
      />
    </div>
  )
}
