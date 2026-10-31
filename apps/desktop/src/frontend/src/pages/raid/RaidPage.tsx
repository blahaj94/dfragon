import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useId } from 'react'
import { Seat } from '../../components/Seat'
import { SeatMoveStatus } from '../../components/SeatMoveStatus'
import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '../../constants/cards'
import { useSeatMove } from '../../hooks/useSeatMove'
import type { SeatArrangement } from '../../hooks/useSeatOrder'
import type { SlotCard, SlotCardActions } from '../../lib/slot-cards'
import { RaidCard } from '../../sections/RaidCard'
import { styles } from './RaidPage.style'

const parties = Array.from({ length: RAID_PARTY_COUNT }, (_, party) =>
  Array.from({ length: RAID_PARTY_SIZE }, (_, member) => party * RAID_PARTY_SIZE + member)
)

export function RaidPage({
  slots,
  resetKey,
  seats,
  actions
}: {
  slots: readonly SlotCard[]
  resetKey: string
  seats: SeatArrangement
  actions: Pick<SlotCardActions, 'lookupSlot' | 'changeSnapshotAdventure'>
}): React.JSX.Element {
  const { seatOrder, canMoveSeats } = seats
  const { lookupSlot, changeSnapshotAdventure } = actions
  const id = useId()
  const { moveSeat, notice } = useSeatMove({ resetKey, seats })
  const hintId = `${id}-move-hint`

  function renderSeat(seat: number, partyLabelId: string): React.JSX.Element {
    const slot = seatOrder[seat]
    const handleLookup = (nickname: string, serverId: string): void =>
      lookupSlot(slot, nickname, serverId)
    const handleChangeSnapshotAdventure = (value: string): void =>
      changeSnapshotAdventure(seat, value)

    return (
      <Seat
        key={`${resetKey}-${slot}`}
        seat={seat + 1}
        move={moveSeat(seat)}
        describedBy={canMoveSeats ? `${partyLabelId} ${hintId}` : partyLabelId}
      >
        <RaidCard
          cardKey={{ id: `raid-${slot}`, resetKey }}
          card={slots[slot]}
          slot={seat + 1}
          onLookup={handleLookup}
          onChangeSnapshotAdventure={handleChangeSnapshotAdventure}
        />
      </Seat>
    )
  }

  return (
    <section aria-label="공대" {...stylex.props(styles.page)}>
      <div id={id} {...stylex.props(styles.scroller)}>
        <div {...stylex.props(styles.board)}>
          {parties.flatMap((seats, party) => {
            // 파티 이름과 카드를 한 배열로 펼쳐 모든 카드가 같은 부모 아래에서 옮겨 다니게 한다.
            const partyLabelId = `${id}-party-${party + 1}`

            return [
              <span key={partyLabelId} id={partyLabelId} {...stylex.props(shapes.srOnly)}>
                {party + 1}파티
              </span>,
              ...seats.map((seat) => renderSeat(seat, partyLabelId))
            ]
          })}
        </div>
      </div>
      <SeatMoveStatus hintId={hintId} layout={seats.layout} notice={notice} />
    </section>
  )
}
