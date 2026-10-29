import * as stylex from '@stylexjs/stylex'
import { styles } from './BoardNotice.style'

export function BoardNotice({ children }: { children: string }): React.JSX.Element {
  return (
    <span role="status" title={children} {...stylex.props(styles.notice)}>
      {children}
    </span>
  )
}
