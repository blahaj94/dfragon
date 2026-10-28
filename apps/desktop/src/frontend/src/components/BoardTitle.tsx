import * as stylex from '@stylexjs/stylex'
import { styles } from './BoardTitle.style'

export function BoardTitle({
  label,
  filled,
  total,
  round
}: {
  label: string
  filled: number
  total: number
  round: number | null
}): React.JSX.Element {
  return (
    <>
      <h1 {...stylex.props(styles.heading)}>{label}</h1>
      <span {...stylex.props(styles.number)}>
        {filled}
        <span {...stylex.props(styles.total)}>/{total}</span>
      </span>
      {round !== null && (
        <span
          aria-label={`${round}번째 ${label}`}
          role="img"
          {...stylex.props(styles.number, styles.round)}
        >
          #{round}
        </span>
      )}
    </>
  )
}
