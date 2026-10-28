import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { shapes } from './shapes'
import { StepDots } from './step-dots'
import { styles } from './status-chip.style'

export type StatusChipTone = 'neutral' | 'success' | 'danger' | 'warning' | 'signal'

export type StatusChipProps = {
  tone: StatusChipTone
  role?: 'status'
  size?: 'sm' | 'md'
  busy?: boolean
  children: ReactNode
}

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
