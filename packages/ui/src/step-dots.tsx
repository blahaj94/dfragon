import * as stylex from '@stylexjs/stylex'
import { styles } from './step-dots.style'

export type StepDotsProps = {
  /** 점 한 변의 px. 4는 상태 칩 안, 5는 목록 안내처럼 글자 옆에 둘 때다. @default 4 */
  size?: 4 | 5
}

// 진행 중임을 보이는 사각 점 세 개. 글자색으로 칠하고 motion.beat마다 steps()로 차례로 켜진다.
// 동작 줄이기에서는 모두 켠 채 멈춘다. 보조 기술에는 옆의 글자가 상태를 전하므로 숨긴다.
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
