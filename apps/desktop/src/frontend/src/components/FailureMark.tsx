import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { styles } from './FailureMark.style'

export function FailureMark({
  label,
  size
}: {
  label: string
  size: 'party' | 'raid'
}): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={label}
      {...stylex.props(
        styles.mark,
        shapes.cutTopRight,
        size === 'party' ? styles.party : styles.raid
      )}
    >
      !
    </span>
  )
}
