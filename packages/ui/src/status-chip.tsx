import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { shapes } from './shapes'
import { StepDots } from './step-dots'
import { styles } from './status-chip.style'

export type StatusChipTone = 'neutral' | 'success' | 'danger' | 'warning' | 'signal'

export type StatusChipProps = {
  tone: StatusChipTone
  /** 상태 변화를 알려야 하는 곳만 `status`를 전달한다. */
  role?: 'status'
  /**
   * sm은 높이 24, md는 상단 바 게임 연결 상태처럼 높이 28이다. 둘 다 오른쪽 위를 자른다.
   * @default 'sm'
   */
  size?: 'sm' | 'md'
  /** 인식처럼 일이 진행 중이면 사각 점 대신 차례로 켜지는 점 세 개를 둔다. @default false */
  busy?: boolean
  children: ReactNode
}

// 상태 글자 앞에 사각 점을 두고 tone 색과 그 옅은 면으로 칠한다. 성공 점은 박자 두 번 주기로 깜박인다.
export function StatusChip({ tone, role, size = 'sm', busy = false, children }: StatusChipProps) {
  return (
    <span
      role={role}
      data-tone={tone}
      data-busy={busy ? '' : undefined}
      {...stylex.props(styles.root, styles[size], shapes.cutTopRight, styles[tone])}
    >
      {busy ? (
        <StepDots />
      ) : (
        <span
          aria-hidden="true"
          {...stylex.props(styles.dot, tone === 'success' && styles.liveDot)}
        />
      )}
      {children}
    </span>
  )
}
