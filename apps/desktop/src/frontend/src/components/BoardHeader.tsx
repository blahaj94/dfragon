import * as stylex from '@stylexjs/stylex'
import { PARTY_SLOT_COUNT } from '../constants/capture'
import { RAID_PARTY_COUNT, RAID_PARTY_SIZE } from '../constants/cards'
import { windowChromeStyles } from '../constants/window-chrome.style'
import { CaptureButton } from './CaptureButton'
import { LastCaptureTime } from './LastCaptureTime'
import { SnapshotToggle } from './SnapshotToggle'
import { styles } from './BoardHeader.style'

const seatCounts = { 파티: PARTY_SLOT_COUNT, 공대: RAID_PARTY_COUNT * RAID_PARTY_SIZE } as const

export function BoardHeader({
  target,
  filledCount,
  notice,
  capture,
  snapshot
}: {
  target: keyof typeof seatCounts
  filledCount: number
  notice: string
  capture: {
    lastCompletedAt: number | null
    canStartCapture: boolean
    startRound: () => void
  }
  snapshot: {
    active: boolean
    round: number | null
    take: () => void
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
