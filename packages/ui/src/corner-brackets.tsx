import * as stylex from '@stylexjs/stylex'
import { styles } from './corner-brackets.style'

export type CornerBracketsTone = 'default' | 'selected' | 'danger' | 'top' | 'ranker'

export type CornerBracketsProps = {
  /** `top`은 꺾쇠가 숨 쉬듯 밝아졌다 흐려지고, `ranker`는 주기마다 바깥에서 조여 든다. */
  tone?: CornerBracketsTone
}

const corners = [
  { position: styles.topLeft, lock: styles.lockTopLeft },
  { position: styles.topRight, lock: styles.lockTopRight },
  { position: styles.bottomLeft, lock: styles.lockBottomLeft },
  { position: styles.bottomRight, lock: styles.lockBottomRight }
]

// 네 모서리 꺾쇠. position이 정해진 부모 안에 두며 부모 테두리 1px 바깥까지 걸친다.
export function CornerBrackets({ tone = 'default' }: CornerBracketsProps) {
  const isTop = tone === 'top'
  const isRanker = tone === 'ranker'

  return corners.map(({ position, lock }, index) => (
    <span
      // 네 모서리는 순서가 바뀌지 않는 고정 목록이다.
      key={index}
      aria-hidden="true"
      {...stylex.props(
        styles.corner,
        position,
        styles[tone],
        (isTop || isRanker) && styles.cycle,
        isTop && styles.breathe,
        isRanker && lock
      )}
    />
  ))
}
