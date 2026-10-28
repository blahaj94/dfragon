import * as stylex from '@stylexjs/stylex'
import { attachBoardHeaderSlot } from '../hooks/useBoardHeaderPortal'
import { styles } from './BoardHeaderSlot.style'

export function BoardHeaderSlot(): React.JSX.Element {
  return <div ref={attachBoardHeaderSlot} {...stylex.props(styles.slot)} />
}
