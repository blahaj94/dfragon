import * as stylex from '@stylexjs/stylex'
import { ProgressCircle } from '@ldb/ui'
import { styles } from './AccountButtonLabel.style'

export function AccountButtonLabel({
  label,
  inProgress
}: {
  label: string
  inProgress: boolean
}): React.JSX.Element {
  return (
    <span {...stylex.props(styles.root)} aria-hidden="true">
      <span {...stylex.props(styles.textMask)}>
        <span {...stylex.props(styles.text, inProgress && styles.textHidden)}>{label}</span>
      </span>
      <span {...stylex.props(styles.iconMask)}>
        <span {...stylex.props(styles.icon, inProgress && styles.iconShown)}>
          <ProgressCircle size="24" />
        </span>
      </span>
    </span>
  )
}
