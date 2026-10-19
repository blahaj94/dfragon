import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { styles } from './SnapshotOverlay.style'

/**
 * 스냅샷에 없는 모험단 카드를 덮는 빨간 빗금과 안쪽 테두리. 카드의 `position: relative` 안쪽 맨 끝에 둔다.
 * 장식이라 보조 기술에서 숨기고, 상태는 카드 머리의 `SnapshotChip`이 이름으로 전한다.
 */
export function SnapshotOverlay(): React.JSX.Element {
  return <span aria-hidden="true" {...stylex.props(styles.layer, shapes.alertHatch)} />
}
