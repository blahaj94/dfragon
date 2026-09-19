import * as stylex from '@stylexjs/stylex'
import { Typo, ProgressCircle } from '@ldb/ui'
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
      <Typo.txtS
        as="span"
        weight={700}
        {...stylex.props(styles.text, inProgress && styles.textHidden)}
      >
        {label}
      </Typo.txtS>
      <span {...stylex.props(styles.icon, inProgress && styles.iconShown)}>
        <ProgressCircle size="24" />
      </span>
    </span>
  )
}
