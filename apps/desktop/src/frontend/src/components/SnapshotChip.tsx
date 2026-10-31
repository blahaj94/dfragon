import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { SnapshotMark } from '../lib/adventure-snapshot'
import { type RaidParty, toRaidSeat } from '../lib/raid-seat'
import { SnapshotIcon } from './SnapshotIcon'
import { styles } from './SnapshotChip.style'

const raidPartyStyles: Readonly<Record<RaidParty, stylex.StyleXStyles>> = {
  R: styles.raidRed,
  Y: styles.raidYellow,
  G: styles.raidGreen
}

export function SnapshotChip({
  mark,
  size
}: {
  mark: SnapshotMark
  size: 'party' | 'raid'
}): React.JSX.Element {
  const moved = mark.kind === 'moved'
  const raidSeat = moved && size === 'raid' ? toRaidSeat(mark.seat) : undefined
  const seat = moved ? (raidSeat?.label ?? String(mark.seat)) : '!'
  const label = moved ? `스냅샷 순번 ${seat}` : '스냅샷에 없는 모험단'

  return (
    <span
      role="img"
      aria-label={label}
      {...stylex.props(
        styles.chip,
        shapes.cutTopRight,
        moved ? styles.moved : styles.absent,
        size === 'party' ? styles.party : styles.raid,
        size === 'party' && (moved ? styles.partyMoved : styles.partyAbsent),
        size === 'raid' && (moved ? styles.raidMoved : styles.raidAbsent),
        raidSeat && raidPartyStyles[raidSeat.party]
      )}
    >
      <SnapshotIcon
        filled={moved}
        strokeWidth="3"
        width={size === 'party' ? 11 : 10}
        height={size === 'party' ? 11 : 10}
      />
      <span aria-hidden="true">{seat}</span>
    </span>
  )
}
