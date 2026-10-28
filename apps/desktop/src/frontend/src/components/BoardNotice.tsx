import * as stylex from '@stylexjs/stylex'
import { styles } from './BoardNotice.style'

export function BoardNotice({ text }: { text: string }): React.JSX.Element {
  return (
    <span role="status" title={text} {...stylex.props(styles.notice)}>
      {text}
    </span>
  )
}
