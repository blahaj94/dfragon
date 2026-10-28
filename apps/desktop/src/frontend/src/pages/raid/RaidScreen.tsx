import { useId } from 'react'
import { BoardHeader } from '../../components/BoardHeader'
import { useAdventureSnapshot } from '../../hooks/useAdventureSnapshot'
import { useBoardHeaderPortal } from '../../hooks/useBoardHeaderPortal'
import { useScreenCaptureContext } from '../../hooks/useScreenCaptureContext'
import { slotAdventureName } from '../../lib/adventure-snapshot'
import { seatValuesToSlotOrder } from '../../lib/raid-seats'
import { filledSlotCount, toSlotCards } from '../../lib/slot-cards'
import { RaidPage } from './RaidPage'

export function RaidScreen({ hidden }: { hidden: boolean }): React.JSX.Element {
  const { raidCapture: capture } = useScreenCaptureContext()
  const cardsId = useId()
  const { search, seatOrder } = capture
  const snapshot = useAdventureSnapshot(
    seatOrder.map((slot) => slotAdventureName(search.slots[slot])),
    capture.startedRounds
  )
  const cards = toSlotCards({
    slots: search.slots,
    nicknames: capture.nicknames,
    manualSlots: search.manualSlots,
    recognizing: capture.recognizing,
    snapshotMarks: seatValuesToSlotOrder(seatOrder, snapshot.marks),
    screen: 'raid'
  })
  const notice = search.connectionFailed
    ? '검색 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
    : ''
  const { renderBoardHeader } = useBoardHeaderPortal()

  return (
    <RaidPage
      id={cardsId}
      hidden={hidden}
      header={
        !hidden &&
        renderBoardHeader(
          <BoardHeader
            target="공대"
            filledCount={filledSlotCount(cards)}
            notice={notice}
            capture={capture}
            snapshot={snapshot}
          />
        )
      }
      resetKey={String(capture.round)}
      slots={cards}
      seats={capture}
      actions={search}
    />
  )
}
