import { Button, IconButton, Kbd, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { PARTY_SLOT_COUNT } from '../constants/capture'
import { CameraIcon } from './CameraIcon'
import { FoldIcon } from './FoldIcon'
import { LastCaptureTime } from './LastCaptureTime'
import { SnapshotIcon } from './SnapshotIcon'
import { styles } from './PartyHeader.style'

/**
 * 파티 카드 위의 머리. 왼쪽에 제목, 채운 자리 수, 캡처 진행 문구를, 오른쪽에 접기 버튼, 마지막 캡처
 * 시간, 스냅샷 버튼, 캡처 주 버튼을 둔다. 캡처 버튼은 Alt+R과 같은 회차 시작을 요청하고, 스냅샷은
 * 기능을 연결하기 전이라 누를 수 없다.
 */
export function PartyHeader({
  status,
  filledCount,
  lastCapturedAt,
  canCapture,
  onCapture,
  collapsed,
  onToggleCollapsed,
  controls
}: {
  status: string
  /** 캐릭터를 찾은 자리 수 */
  filledCount: number
  /** 마지막으로 인식을 마친 회차의 완료 시각(ms). 없으면 null이다. */
  lastCapturedAt: number | null
  /** Alt+R이 지금 회차를 시작할 수 있는지. 아니면 버튼도 누를 수 없다. */
  canCapture: boolean
  onCapture: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
  /** 접기 버튼이 펼치고 접는 카드 영역의 id */
  controls: string
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.title)}>
        <Typo.h4 as="h1" weight={700} {...stylex.props(styles.heading)}>
          파티
        </Typo.h4>
        <span {...stylex.props(styles.count)}>
          {filledCount}
          <span {...stylex.props(styles.total)}>/{PARTY_SLOT_COUNT}</span>
        </span>
        <span role="status" {...stylex.props(styles.status)}>
          {status}
        </span>
      </div>
      <div {...stylex.props(styles.actions)}>
        <IconButton
          size="lg"
          aria-label={collapsed ? '카드 펼치기' : '카드 접기'}
          aria-expanded={!collapsed}
          aria-controls={controls}
          onClick={onToggleCollapsed}
          icon={<FoldIcon collapsed={collapsed} />}
        />
        <LastCaptureTime key={lastCapturedAt ?? 'none'} at={lastCapturedAt} />
        <IconButton
          size="lg"
          aria-label="파티 모험단 순번 스냅샷"
          disabled
          icon={<SnapshotIcon />}
        />
        <Button
          variant="primary"
          size="lg"
          aria-label="파티 캡처, 단축키 Alt R"
          aria-keyshortcuts="Alt+R"
          disabled={!canCapture}
          onClick={onCapture}
        >
          <span {...stylex.props(styles.capture)}>
            <CameraIcon width={24} height={24} />
            <span aria-hidden="true" {...stylex.props(styles.captureDivider)} />
            <span aria-hidden="true" {...stylex.props(styles.keys)}>
              <Kbd surface="signal">Alt</Kbd>
              <Kbd surface="signal">R</Kbd>
            </span>
          </span>
        </Button>
      </div>
    </div>
  )
}
