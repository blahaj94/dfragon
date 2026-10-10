import * as stylex from '@stylexjs/stylex'
import { Typo, ProgressCircle } from '@dfragon/ui'
import { styles } from './LoginButtonLabel.style'

export function LoginButtonLabel({
  label,
  inProgress
}: {
  label: string
  inProgress: boolean
}): React.JSX.Element {
  return (
    // The root carries the label font so the em-based widths match the 16px label.
    <Typo.txtM
      as="span"
      weight={700}
      aria-hidden="true"
      {...stylex.props(styles.root, inProgress && styles.compact)}
    >
      <span {...stylex.props(styles.text, inProgress && styles.textHidden)}>{label}</span>
      <span {...stylex.props(styles.icon, inProgress && styles.iconShown)}>
        <ProgressCircle size="24" />
      </span>
    </Typo.txtM>
  )
}
