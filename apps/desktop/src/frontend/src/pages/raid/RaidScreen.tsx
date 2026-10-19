import { useId } from 'react'
import { BoardHeader } from '../../components/BoardHeader'
import { useAdventureSnapshot } from '../../hooks/useAdventureSnapshot'
import type { PartyCollapse } from '../../hooks/usePartyCollapse'
import type { RaidCapture } from '../../hooks/useRaidCapture'
import { slotAdventureName } from '../../lib/adventure-snapshot'
import { seatValuesToSlotOrder } from '../../lib/raid-seats'
import { filledSlotCount, toSlotCards } from '../../lib/slot-cards'
import { RaidPage } from './RaidPage'

/** 공대 화면이 공대 캡처에서 읽는 값 */
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
  search: Pick<
    RaidCapture['search'],
    'slots' | 'manualSlots' | 'connectionFailed' | 'detailNotice' | 'lookupSlot' | 'openDetails'
  >
}

/**
 * 공대 화면. 공대 캡처 결과로 머리 안내와 자리별 카드가 그릴 값을 계산해 `RaidPage`에 넘긴다. 모험단 순번
 * 스냅샷은 이 화면이 가진다. 파티를 보는 동안에도 자리별 입력과 검색 상태를 유지하도록 숨기기만 하고 그린 채
 * 둔다.
 */
export function RaidScreen({
  capture,
  hidden,
  collapse
}: {
  capture: RaidScreenCapture
  hidden: boolean
  /** 파티와 공대가 함께 쓰는 카드 접기 */
  collapse: PartyCollapse
}): React.JSX.Element {
  const cardsId = useId()
  const { search, seatOrder } = capture
  // 모험단 순번 스냅샷은 화면 자리 기준이라 맞바꾼 배치를 따라 자리마다 모험단을 읽는다.
  const snapshot = useAdventureSnapshot(
    seatOrder.map((slot) => slotAdventureName(search.slots[slot])),
    capture.startedRounds
  )
  const cards = toSlotCards({
    slots: search.slots,
    nicknames: capture.nicknames,
    manualSlots: search.manualSlots,
    recognizing: capture.recognizing,
    // 스냅샷 표시는 화면 자리 순서라 슬롯 순서로 다시 배치해 카드 값에 담는다.
    snapshotMarks: seatValuesToSlotOrder(seatOrder, snapshot.marks),
    screen: 'raid'
  })
  // 공대 머리도 파티 머리처럼 캡처 진행 문구를 두지 않는다. 공대 회차 문구는 상단 바의 화면 밖 캡처
  // 안내와 캡처 대화상자가 알린다.
  let notice = ''
  if (search.connectionFailed) {
    notice = '검색 연결을 확인하지 못했습니다. 앱 화면을 다시 열어 주세요.'
  } else if (search.detailNotice) {
    notice = search.detailNotice
  }

  return (
    <RaidPage
      id={cardsId}
      hidden={hidden}
      header={
        <BoardHeader
          target="공대"
          filledCount={filledSlotCount(cards)}
          notice={notice}
          capture={capture}
          snapshot={snapshot}
          collapse={collapse}
          controls={cardsId}
        />
      }
      resetKey={String(capture.round)}
      slots={cards}
      seats={capture}
      collapsed={collapse.collapsed}
      actions={search}
    />
  )
}
