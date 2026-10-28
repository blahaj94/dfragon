import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { ProgressCircle } from './progress-circle'
import { styles } from './loading-indicator.style'

export type LoadingIndicatorProps = {
  children?: ReactNode
}

export function LoadingIndicator({ children }: LoadingIndicatorProps) {
  return (
    <span {...stylex.props(styles.root)}>
      <span {...stylex.props(styles.hiddenLabel)}>{children}</span>
      <span {...stylex.props(styles.indicator)}>
        <ProgressCircle size="inherit" tone="inherit" aria-hidden="true" />
      </span>
    </span>
  )
}
