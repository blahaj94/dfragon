import * as stylex from '@stylexjs/stylex'
import { styles } from './corner-brackets.style'

export type CornerBracketsTone = 'default' | 'selected' | 'failure' | 'top' | 'ranker'

export type CornerBracketsProps = {
  tone?: CornerBracketsTone
}

const corners = [
  { position: styles.topLeft, pulse: styles.pulseTopLeft, lock: styles.lockTopLeft },
  { position: styles.topRight, pulse: styles.pulseTopRight, lock: styles.lockTopRight },
  { position: styles.bottomLeft, pulse: styles.pulseBottomLeft, lock: styles.lockBottomLeft },
  { position: styles.bottomRight, pulse: styles.pulseBottomRight, lock: styles.lockBottomRight }
]

export function CornerBrackets({ tone = 'default' }: CornerBracketsProps) {
  const isSelected = tone === 'selected'
  const isTop = tone === 'top'
  const isRanker = tone === 'ranker'

  return corners.map(({ position, pulse, lock }, index) => (
    <span
      key={index}
      aria-hidden="true"
      {...stylex.props(
        styles.corner,
        position,
        styles[tone],
        isSelected && styles.pulse,
        isSelected && pulse,
        (isTop || isRanker) && styles.cycle,
        isTop && styles.breathe,
        isRanker && lock
      )}
    />
  ))
}
