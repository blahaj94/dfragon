import { useId } from 'react'
import { BoardHeader } from '../../components/BoardHeader'
import { BoardHeaderPortal } from '../../components/BoardHeaderPortal'
import { useAdventureSnapshot } from '../../hooks/useAdventureSnapshot'
import type { RaidCapture } from '../../hooks/useRaidCapture'
import { slotAdventureName } from '../../lib/adventure-snapshot'
import { seatValuesToSlotOrder } from '../../lib/raid-seats'
import { filledSlotCount, toSlotCards } from '../../lib/slot-cards'
import { RaidPage } from './RaidPage'

export type RaidScreenCapture = Pick<
  RaidCapture,
  | 'nicknames'
  | 'recognizing'
  | 'round'
  | 'startedRounds'
  | 'lastCompletedAt'
  | 'canStartCapture'
  | 'startRound'
  | 'seatOrder'
  | 'canMoveSeats'
  | 'swapSeats'
> & {
  search: Pick<RaidCapture['search'], 'slots' | 'manualSlots' | 'connectionFailed' | 'lookupSlot'>
}

export function RaidScreen({
  capture,
  hidden
}: {
  capture: RaidScreenCapture
  hidden: boolean
}): React.JSX.Element {
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

  return (
    <RaidPage
      id={cardsId}
      hidden={hidden}
      header={
        !hidden && (
          <BoardHeaderPortal>
            <BoardHeader
              target="공대"
              filledCount={filledSlotCount(cards)}
              notice={notice}
              capture={capture}
              snapshot={snapshot}
            />
          </BoardHeaderPortal>
        )
      }
      resetKey={String(capture.round)}
      slots={cards}
      seats={capture}
      actions={search}
    />
  )
}
