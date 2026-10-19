import * as stylex from '@stylexjs/stylex'
import { styles } from './corner-brackets.style'

export type CornerBracketsTone = 'default' | 'selected' | 'failure' | 'top' | 'ranker'

export type CornerBracketsProps = {
  /**
   * `selected`는 박자 두 번마다 바깥 4px에서 조여 들고, `top`은 꺾쇠가 숨 쉬듯 밝아졌다 흐려지며,
   * `ranker`는 주기마다 바깥 10px에서 조여 든다.
   */
  tone?: CornerBracketsTone
}

const corners = [
  { position: styles.topLeft, pulse: styles.pulseTopLeft, lock: styles.lockTopLeft },
  { position: styles.topRight, pulse: styles.pulseTopRight, lock: styles.lockTopRight },
  { position: styles.bottomLeft, pulse: styles.pulseBottomLeft, lock: styles.lockBottomLeft },
  { position: styles.bottomRight, pulse: styles.pulseBottomRight, lock: styles.lockBottomRight }
]

// 네 모서리 꺾쇠. position이 정해진 부모 안에 두며 부모 테두리 1px 바깥까지 걸친다.
export function CornerBrackets({ tone = 'default' }: CornerBracketsProps) {
  const isSelected = tone === 'selected'
  const isTop = tone === 'top'
  const isRanker = tone === 'ranker'

  return corners.map(({ position, pulse, lock }, index) => (
    <span
      // 네 모서리는 순서가 바뀌지 않는 고정 목록이다.
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
