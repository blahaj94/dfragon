import { Button, IconButton, Kbd, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { PARTY_SLOT_COUNT } from '../constants/capture'
import { CameraIcon } from './CameraIcon'
import { FoldIcon } from './FoldIcon'
import { LastCaptureTime } from './LastCaptureTime'
import { SnapshotToggle } from './SnapshotToggle'
import { styles } from './PartyHeader.style'

/**
 * 파티 카드 위의 머리. 왼쪽에 제목, 채운 자리 수, 상세 열기 실패 안내를, 오른쪽에 접기 버튼, 마지막
 * 캡처 시간, 스냅샷 토글, 캡처 주 버튼을 둔다. 캡처 진행 상태는 상단 바 상태 칩과 캡처 대화상자가
 * 보이므로 여기에 문구로 되풀이하지 않는다. 캡처 버튼은 Alt+R과 같은 회차 시작을 요청한다.
 */
export function PartyHeader({
  notice,
  filledCount,
  lastCapturedAt,
  canCapture,
  onCapture,
  snapshotActive,
  onTakeSnapshot,
  onClearSnapshot,
  collapsed,
  onToggleCollapsed,
  controls
}: {
  /** 상세 정보 창을 열지 못했을 때처럼 카드에서 누른 동작의 실패 안내. 없으면 빈 문자열이다. */
  notice: string
  /** 캐릭터를 찾은 자리 수 */
  filledCount: number
  /** 마지막으로 인식을 마친 회차의 완료 시각(ms). 없으면 null이다. */
  lastCapturedAt: number | null
  /** Alt+R이 지금 회차를 시작할 수 있는지. 아니면 버튼도 누를 수 없다. */
  canCapture: boolean
  onCapture: () => void
  /** 모험단 순번 스냅샷을 켜 둔 상태 */
  snapshotActive: boolean
  onTakeSnapshot: () => void
  /** 끄기 확인을 거친 뒤 스냅샷을 지운다. */
  onClearSnapshot: () => void
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
        <span role="status" {...stylex.props(styles.notice)}>
          {notice}
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
        <SnapshotToggle
          label="파티 모험단 순번 스냅샷"
          active={snapshotActive}
          onTake={onTakeSnapshot}
          onClear={onClearSnapshot}
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
