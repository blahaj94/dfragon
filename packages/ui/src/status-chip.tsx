import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { HourglassIcon } from './icons'
import { shapes } from './shapes'
import { styles } from './status-chip.style'

export type StatusChipTone = 'neutral' | 'success' | 'danger' | 'waiting'

export type StatusChipProps = {
  tone: StatusChipTone
  /** 상태 변화를 알려야 하는 곳만 `status`를 전달한다. */
  role?: 'status'
  /** sm은 높이 24, 반지름 2인 칩, md는 상단 바 게임 연결 상태처럼 높이 28에 오른쪽 위를 자른 칩이다. @default 'sm' */
  size?: 'sm' | 'md'
  children: ReactNode
}

// 상태 글자 앞에 사각 점을 두고 tone 색으로 칠한다. waiting은 면 없이 중립색에 각진 모래시계를 둔다.
export function StatusChip({ tone, role, size = 'sm', children }: StatusChipProps) {
  return (
    <span
      role={role}
      data-tone={tone}
      {...stylex.props(
        styles.root,
        styles[size],
        size === 'md' && shapes.cutTopRight,
        styles[tone]
      )}
    >
      {tone === 'waiting' ? (
        <HourglassIcon {...stylex.props(styles.icon)} />
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
