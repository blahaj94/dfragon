import * as stylex from '@stylexjs/stylex'
import { Badge } from '@seed-design/react'
import { styles } from './StatusBadge.style'

export type StatusBadgeTone = 'neutral' | 'informative' | 'critical' | 'warning' | 'positive'

type StatusBadgeProps = {
  tone: StatusBadgeTone
  role?: 'status'
  children: React.ReactNode
}

/** 디자인 StatusBadge: SEED large Badge를 bg.inset 알약으로 두고 8px 점과 글자를 상태색으로 칠한다. */
export function StatusBadge({ tone, role, children }: StatusBadgeProps): React.JSX.Element {
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
