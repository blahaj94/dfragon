import * as stylex from '@stylexjs/stylex'
import { BoardHeader } from '../../components/BoardHeader'
import { BoardTitle } from '../../components/BoardTitle'
import { CaptureButton } from '../../components/CaptureButton'
import { ClipboardCopyButton } from '../../components/ClipboardCopyButton'
import { LastCaptureTime } from '../../components/LastCaptureTime'
import { SnapshotToggle } from '../../components/SnapshotToggle'
import { useBoardHeaderPortal } from '../../hooks/useBoardHeaderPortal'
import { useClipboardCopy } from '../../hooks/useClipboardCopy'
import { useDesktopShortcut } from '../../hooks/useDesktopShortcut'
import { usePartySlotCards } from '../../hooks/usePartySlotCards'
import { useScreenCaptureContext } from '../../hooks/useScreenCaptureContext'
import { filledSlotCount } from '../../lib/slot-cards'
import { PartyPage } from './PartyPage'
import { styles } from './PartyScreen.style'

export function PartyScreen(): React.JSX.Element {
  const { partyCapture: capture } = useScreenCaptureContext()
  const { cards, snapshot, clipboardText } = usePartySlotCards(capture)
  const { renderBoardHeader } = useBoardHeaderPortal()
  const clipboard = useClipboardCopy(clipboardText)
  useDesktopShortcut('take-snapshot', !snapshot.active, snapshot.take)
  useDesktopShortcut('copy-clipboard', true, clipboard.copy)

  return (
    <div {...stylex.props(styles.party)}>
      {renderBoardHeader(
        <BoardHeader
          start={
            <>
              <BoardTitle
                label="파티"
                filled={filledSlotCount(cards)}
                total={cards.length}
                round={snapshot.round}
              />
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
              <ClipboardCopyButton status={clipboard.status} onCopy={clipboard.copy} />
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
        seats={capture.seats}
        actions={{
          lookupSlot: capture.search.lookupSlot,
          pickCandidate: capture.search.pickCandidate,
          changeSnapshotAdventure: snapshot.changeAdventure
        }}
      />
    </div>
  )
}
