import { BoardHeader } from '../../components/BoardHeader'
import { BoardNotice } from '../../components/BoardNotice'
import { BoardTitle } from '../../components/BoardTitle'
import { CaptureButton } from '../../components/CaptureButton'
import { ClipboardCopyButton } from '../../components/ClipboardCopyButton'
import { LastCaptureTime } from '../../components/LastCaptureTime'
import { SnapshotToggle } from '../../components/SnapshotToggle'
import { useBoardHeaderPortal } from '../../hooks/useBoardHeaderPortal'
import { useClipboardCopy } from '../../hooks/useClipboardCopy'
import { useDesktopShortcut } from '../../hooks/useDesktopShortcut'
import { useRaidSlotCards } from '../../hooks/useRaidSlotCards'
import { useScreenCaptureContext } from '../../hooks/useScreenCaptureContext'
import { filledSlotCount } from '../../lib/slot-cards'
import { RaidPage } from './RaidPage'

export function RaidScreen(): React.JSX.Element {
  const { raidCapture: capture } = useScreenCaptureContext()
  const { cards, snapshot, clipboardText } = useRaidSlotCards(capture)
  const notice = capture.search.connectionFailed
    ? '검색 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
    : ''
  const { renderBoardHeader } = useBoardHeaderPortal()
  const clipboard = useClipboardCopy(clipboardText)
  useDesktopShortcut('take-snapshot', !snapshot.active, snapshot.take)
  useDesktopShortcut('copy-clipboard', true, clipboard.copy)

  return (
    <>
      {renderBoardHeader(
        <BoardHeader
          start={
            <>
              <BoardTitle
                label="공대"
                filled={filledSlotCount(cards)}
                total={cards.length}
                round={snapshot.round}
              />
              <BoardNotice>{notice}</BoardNotice>
            </>
          }
          end={
            <>
              <LastCaptureTime at={capture.lastCompletedAt} />
              <SnapshotToggle
                label="공대 모험단 순번 스냅샷"
                active={snapshot.active}
                onTake={snapshot.take}
                onClear={snapshot.clear}
              />
              <ClipboardCopyButton status={clipboard.status} onCopy={clipboard.copy} />
              <CaptureButton
                target="공대"
                disabled={!capture.canStartCapture}
                onClick={capture.startRound}
              />
            </>
          }
        />
      )}
      <RaidPage
        resetKey={String(capture.round)}
        slots={cards}
        seats={capture.seats}
        actions={{
          lookupSlot: capture.search.lookupSlot,
          changeSnapshotAdventure: snapshot.changeAdventure
        }}
      />
    </>
  )
}
