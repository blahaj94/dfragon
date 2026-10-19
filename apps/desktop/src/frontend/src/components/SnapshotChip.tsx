import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { SnapshotMark } from '../lib/adventure-snapshot'
import { SnapshotIcon } from './SnapshotIcon'
import { styles } from './SnapshotChip.style'

/**
 * 카드 머리에서 스냅샷과 비교한 결과를 알리는 칩. 자리가 바뀐 카드는 스냅샷 때의 자리 번호(앞에 0을
 * 채우지 않는다)를, 스냅샷에 없는 모험단은 `!`를 보인다. 상태를 색으로만 전하지 않도록 글자와 이름을
 * 함께 둔다.
 */
export function SnapshotChip({
  mark,
  size
}: {
  mark: SnapshotMark
  /** 파티 카드는 `party`, 공대 카드는 `raid` */
  size: 'party' | 'raid'
}): React.JSX.Element {
  const moved = mark.kind === 'moved'
  const label = moved ? `스냅샷 순번 ${mark.seat}` : '스냅샷에 없는 모험단'

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
        size === 'raid' && (moved ? styles.raidMoved : styles.raidAbsent)
      )}
    >
      <SnapshotIcon
        center={moved}
        strokeWidth="3"
        width={size === 'party' ? 11 : 10}
        height={size === 'party' ? 11 : 10}
      />
      <span aria-hidden="true">{moved ? mark.seat : '!'}</span>
    </span>
  )
}
