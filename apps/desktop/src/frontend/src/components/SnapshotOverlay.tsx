import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { styles } from './SnapshotOverlay.style'

export function SnapshotOverlay(): React.JSX.Element {
  return <span aria-hidden="true" {...stylex.props(styles.layer, shapes.alertHatch)} />
}
