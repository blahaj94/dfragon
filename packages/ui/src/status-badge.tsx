import * as stylex from '@stylexjs/stylex'
import { Badge } from '@seed-design/react'
import type { ReactNode } from 'react'
import { styles } from './status-badge.style'

export type StatusBadgeTone = 'neutral' | 'informative' | 'critical' | 'warning' | 'positive'

export type StatusBadgeProps = {
  tone: StatusBadgeTone
  role?: 'status'
  children: ReactNode
}

// DFragon 디자인 컴포넌트: SEED large Badge를 gray-100 알약으로 두고 8px 점과 글자를 상태색으로 칠한다.
export function StatusBadge({ tone, role, children }: StatusBadgeProps) {
  return (
    <Badge
      size="large"
      variant="weak"
      tone={tone}
      role={role}
      {...stylex.props(styles.badge, styles[tone])}
    >
      <span aria-hidden="true" {...stylex.props(styles.dot)} />
      {children}
    </Badge>
  )
}
