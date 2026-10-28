import * as stylex from '@stylexjs/stylex'
import { styles } from './step-dots.style'

export type StepDotsProps = {
  size?: 4 | 5
}

export function StepDots({ size = 4 }: StepDotsProps) {
  const gap = size === 4 ? styles.size4 : styles.size5
  const dot = size === 4 ? styles.dot4 : styles.dot5

  return (
    <span aria-hidden="true" {...stylex.props(styles.root, gap)}>
      <span {...stylex.props(styles.dot, dot)} />
      <span {...stylex.props(styles.dot, dot, styles.second)} />
      <span {...stylex.props(styles.dot, dot, styles.third)} />
    </span>
  )
}
