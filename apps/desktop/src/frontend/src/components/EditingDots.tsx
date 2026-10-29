import * as stylex from '@stylexjs/stylex'
import { styles } from './EditingDots.style'

export function EditingDots({
  label,
  size
}: {
  label: string
  size: 'party' | 'raid'
}): React.JSX.Element {
  const dotSize = size === 'party' ? styles.partyDot : styles.raidDot

  return (
    <span
      role="img"
      aria-label={label}
      {...stylex.props(styles.dots, size === 'party' ? styles.party : styles.raid)}
    >
      <span {...stylex.props(styles.dot, dotSize)} />
      <span {...stylex.props(styles.dot, dotSize, styles.dotSecond)} />
      <span {...stylex.props(styles.dot, dotSize, styles.dotThird)} />
    </span>
  )
}
