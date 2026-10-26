import { IconButton, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { PARTY_SLOT_COUNT } from '../constants/capture'
import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '../constants/cards'
import { CaptureButton } from './CaptureButton'
import { FoldIcon } from './FoldIcon'
import { LastCaptureTime } from './LastCaptureTime'
import { SnapshotToggle } from './SnapshotToggle'
import { styles } from './BoardHeader.style'

// 머리 제목 오른쪽 인원수의 분모. 파티는 네 자리, 공대는 세 파티 네 자리씩이다.
const seatCounts = { 파티: PARTY_SLOT_COUNT, 공대: RAID_PARTY_COUNT * RAID_PARTY_SIZE } as const

/**
 * 파티 카드와 공대 보드 위의 머리. 왼쪽에 제목, 채운 자리 수, 스냅샷 회차 번호, 카드에서 누른 동작의 실패
 * 안내를, 오른쪽에 접기 버튼, 마지막 캡처 시간, 스냅샷 토글, 캡처 주 버튼을 둔다. 캡처 진행 상태는 상단 바
 * 상태 칩과 캡처 대화상자가 보이므로 여기에 문구로 되풀이하지 않는다. 캡처 버튼은 Alt+R과 같은 회차
 * 시작을 요청한다. 캡처, 스냅샷, 접기 값은 각 hook 결과의 필드 이름 그대로 받는다.
 */
export function BoardHeader({
  target,
  filledCount,
  notice,
  capture,
  snapshot,
  collapse,
  controls
}: {
  /** 머리가 놓인 화면. 제목, 전체 자리 수와 회차 번호, 스냅샷, 캡처 버튼의 이름을 정한다. */
  target: keyof typeof seatCounts
  /** 캐릭터를 찾은 자리 수 */
  filledCount: number
  /** 검색 연결 실패처럼 캡처 진행이 아닌 안내. 없으면 빈 문자열이다. */
  notice: string
  capture: {
    /** 마지막으로 인식을 마친 회차의 완료 시각(ms). 없으면 null이다. */
    lastCompletedAt: number | null
    /** Alt+R이 지금 회차를 시작할 수 있는지. 아니면 버튼도 누를 수 없다. */
    canStartCapture: boolean
    startRound: () => void
  }
  /** 모험단 순번 스냅샷 */
  snapshot: {
    active: boolean
    /** 스냅샷을 켠 뒤 몇 번째 회차인지. 스냅샷이 없으면 null이라 번호를 보이지 않는다. */
    round: number | null
    take: () => void
    /** 끄기 확인을 거친 뒤 스냅샷을 지운다. */
    clear: () => void
  }
  /** 파티와 공대가 함께 쓰는 카드 접기 */
  collapse: { collapsed: boolean; toggleCollapsed: () => void }
  /** 접기 버튼이 펼치고 접는 카드 영역의 id */
  controls: string
}): React.JSX.Element {
  const { collapsed } = collapse

  return (
    <div {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.title)}>
        <Typo.h4 as="h1" weight={700} {...stylex.props(styles.heading)}>
          {target}
        </Typo.h4>
        <span {...stylex.props(styles.count)}>
          {filledCount}
          <span {...stylex.props(styles.total)}>/{seatCounts[target]}</span>
        </span>
        {snapshot.round !== null && (
          <span
            aria-label={`${snapshot.round}번째 ${target}`}
            role="img"
            {...stylex.props(styles.round)}
          >
            #{snapshot.round}
          </span>
        )}
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
          onClick={collapse.toggleCollapsed}
          icon={<FoldIcon collapsed={collapsed} />}
        />
        <LastCaptureTime key={capture.lastCompletedAt ?? 'none'} at={capture.lastCompletedAt} />
        <SnapshotToggle
          label={`${target} 모험단 순번 스냅샷`}
          active={snapshot.active}
          onTake={snapshot.take}
          onClear={snapshot.clear}
        />
        <CaptureButton
          target={target}
          disabled={!capture.canStartCapture}
          onClick={capture.startRound}
        />
      </div>
    </div>
  )
}
