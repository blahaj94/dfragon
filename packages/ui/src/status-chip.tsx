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

/** @deprecated `StatusChip`의 tone을 쓴다. */
export type StatusBadgeTone = 'neutral' | 'informative' | 'critical' | 'warning' | 'positive'

/** @deprecated `StatusChipProps`를 쓴다. */
export type StatusBadgeProps = Omit<StatusChipProps, 'tone'> & { tone: StatusBadgeTone }

const tones: Record<StatusBadgeTone, StatusChipTone> = {
  neutral: 'neutral',
  informative: 'neutral',
  critical: 'danger',
  warning: 'waiting',
  positive: 'success'
}

/**
 * SEED Badge 시절 tone 이름을 StatusChip tone으로 바꿔 전달한다. Desktop DFragon 디자인 적용의
 * 마지막 PR에서 지운다.
 * @deprecated `StatusChip`을 쓴다.
 */
export function StatusBadge({ tone, ...props }: StatusBadgeProps) {
  return <StatusChip tone={tones[tone]} {...props} />
}
