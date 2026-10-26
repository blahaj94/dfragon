import * as stylex from '@stylexjs/stylex'
import { PARTY_SLOT_COUNT } from '../constants/capture'
import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '../constants/cards'
import { windowChromeStyles } from '../constants/window-chrome.style'
import { CaptureButton } from './CaptureButton'
import { LastCaptureTime } from './LastCaptureTime'
import { SnapshotToggle } from './SnapshotToggle'
import { styles } from './BoardHeader.style'

// 머리 제목 오른쪽 인원수의 분모. 파티는 네 자리, 공대는 세 파티 네 자리씩이다.
const seatCounts = { 파티: PARTY_SLOT_COUNT, 공대: RAID_PARTY_COUNT * RAID_PARTY_SIZE } as const

/**
 * 상단 바 안에 한 줄로 그리는 파티, 공대 머리. 왼쪽에 제목, 채운 자리 수, 스냅샷 회차 번호, 카드에서 누른
 * 동작의 실패 안내를, 오른쪽에 마지막 캡처 시간, 스냅샷 토글, 캡처 주 버튼을 둔다. 캡처 진행 상태는 상단 바
 * 상태 칩과 캡처 창이 보이므로 여기에 문구로 되풀이하지 않는다. 캡처 버튼은 Alt+R과 같은 회차 시작을
 * 요청한다. 캡처, 스냅샷 값은 각 hook 결과의 필드 이름 그대로 받는다.
 */
export function BoardHeader({
  target,
  filledCount,
  notice,
  capture,
  snapshot
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
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.title)}>
        <h1 {...stylex.props(styles.heading)}>{target}</h1>
        <span {...stylex.props(styles.number)}>
          {filledCount}
          <span {...stylex.props(styles.total)}>/{seatCounts[target]}</span>
        </span>
        {snapshot.round !== null && (
          <span
            aria-label={`${snapshot.round}번째 ${target}`}
            role="img"
            {...stylex.props(styles.number, styles.round)}
          >
            #{snapshot.round}
          </span>
        )}
        <span role="status" title={notice} {...stylex.props(styles.notice)}>
          {notice}
        </span>
      </div>
      <div {...stylex.props(styles.actions)}>
        <LastCaptureTime key={capture.lastCompletedAt ?? 'none'} at={capture.lastCompletedAt} />
        <span {...stylex.props(windowChromeStyles.noDrag)}>
          <SnapshotToggle
            label={`${target} 모험단 순번 스냅샷`}
            active={snapshot.active}
            onTake={snapshot.take}
            onClear={snapshot.clear}
          />
        </span>
        <span {...stylex.props(windowChromeStyles.noDrag)}>
          <CaptureButton
            target={target}
            disabled={!capture.canStartCapture}
            onClick={capture.startRound}
          />
        </span>
      </div>
    </div>
  )
}
