import * as stylex from '@stylexjs/stylex'
import { useId } from 'react'
import { Seat } from '../../components/Seat'
import { SeatMoveStatus } from '../../components/SeatMoveStatus'
import { useSeatMove } from '../../hooks/useSeatMove'
import type { SeatArrangement } from '../../hooks/useSeatOrder'
import { CharacterCard } from '../../sections/CharacterCard'
import type { SlotCard, SlotCardActions } from '../../lib/slot-cards'
import { styles } from './PartyPage.style'

export function PartyPage({
  slots,
  resetKey,
  seats,
  actions
}: {
  slots: readonly SlotCard[]
  resetKey: string
  seats: SeatArrangement
  actions: SlotCardActions
}): React.JSX.Element {
  const { seatOrder, canMoveSeats } = seats
  const { lookupSlot, pickCandidate, changeSnapshotAdventure } = actions
  const hintId = useId()
  const { moveSeat, notice } = useSeatMove({ resetKey, seats })

  function renderSeat(slot: number, seat: number): React.JSX.Element {
    const handleLookup = (nickname: string, serverId: string): void =>
      lookupSlot(slot, nickname, serverId)
    const handlePickCandidate = (serverId: string): void => pickCandidate(slot, serverId)
    const handleChangeSnapshotAdventure = (value: string): void =>
      changeSnapshotAdventure(seat, value)

    return (
      <Seat
        key={`${resetKey}-${slot}`}
        seat={seat + 1}
        move={moveSeat(seat)}
        describedBy={canMoveSeats ? hintId : undefined}
      >
        <CharacterCard
          cardKey={{ id: `party-${slot}`, resetKey }}
          card={slots[slot]}
          slot={seat + 1}
          onLookup={handleLookup}
          onPickCandidate={handlePickCandidate}
          onChangeSnapshotAdventure={handleChangeSnapshotAdventure}
        />
      </Seat>
    )
  }

  return (
    <section aria-label="파티 캐릭터" {...stylex.props(styles.grid)}>
      {seatOrder.map(renderSeat)}
      <SeatMoveStatus hintId={hintId} layout={seats.layout} notice={notice} />
    </section>
  )
}
