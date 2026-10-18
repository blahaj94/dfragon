import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { ProgressCircle } from './progress-circle'
import { styles } from './loading-indicator.style'

export type LoadingIndicatorProps = {
  children?: ReactNode
}

// 진행 중인 작업 표시. 글자 자리 위에 진행 원을 겹치며 글자 공간을 그대로 둔다.
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
