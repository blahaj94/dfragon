import * as stylex from '@stylexjs/stylex'
import { ProgressCircle } from '@ldb/ui'
import { styles } from './LoginButtonLabel.style'

export function LoginButtonLabel({
  label,
  inProgress
}: {
  label: string
  inProgress: boolean
}): React.JSX.Element {
  return (
    <span {...stylex.props(styles.root, inProgress && styles.compact)} aria-hidden="true">
      <span {...stylex.props(styles.text, inProgress && styles.textHidden)}>{label}</span>
      <span {...stylex.props(styles.icon, inProgress && styles.iconShown)}>
        <ProgressCircle size="24" />
      </span>
    </span>
  )
}
