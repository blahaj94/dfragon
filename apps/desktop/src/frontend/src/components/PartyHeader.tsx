import { IconButton, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { FoldIcon } from './FoldIcon'
import { SnapshotIcon } from './SnapshotIcon'
import { styles } from './PartyHeader.style'

/**
 * 파티 카드 위의 머리. 제목과 캡처 진행 문구, 네 카드를 함께 접는 버튼과 스냅샷 버튼을 둔다.
 * 스냅샷은 기능을 연결하기 전이라 누를 수 없다.
 */
export function PartyHeader({
  status,
  collapsed,
  onToggleCollapsed,
  controls
}: {
  status: string
  collapsed: boolean
  onToggleCollapsed: () => void
  /** 접기 버튼이 펼치고 접는 카드 영역의 id */
  controls: string
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.title)}>
        <Typo.h4 as="h1" weight={700}>
          파티
        </Typo.h4>
        <Typo.caption role="status" {...stylex.props(styles.status)}>
          {status}
        </Typo.caption>
      </div>
      <div {...stylex.props(styles.actions)}>
        <IconButton
          aria-label={collapsed ? '카드 펼치기' : '카드 접기'}
          aria-expanded={!collapsed}
          aria-controls={controls}
          onClick={onToggleCollapsed}
          icon={<FoldIcon collapsed={collapsed} />}
        />
        <IconButton aria-label="파티 모험단 순번 스냅샷" disabled icon={<SnapshotIcon />} />
      </div>
    </div>
  )
}
