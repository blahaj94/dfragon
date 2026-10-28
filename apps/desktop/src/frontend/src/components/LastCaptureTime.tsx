import * as stylex from '@stylexjs/stylex'
import { MISSING_VALUE } from '../constants/cards'
import { useElapsedTime } from '../hooks/useElapsedTime'
import { styles } from './LastCaptureTime.style'

export function LastCaptureTime({ at }: { at: number | null }): React.JSX.Element {
  // 완료 시각이 바뀌면 이전 시각의 타이머를 버리고 새 시각부터 다시 잰다.
  return <ElapsedCaptureTime key={at ?? 'none'} at={at} />
}

function ElapsedCaptureTime({ at }: { at: number | null }): React.JSX.Element {
  const time = useElapsedTime(at)

  return (
    <div {...stylex.props(styles.root)}>
      <span>
        <span {...stylex.props(styles.label)}>마지막 캡처</span>
        <CaptureTimeValue at={at} time={time} />
      </span>
    </div>
  )
}

function CaptureTimeValue({
  at,
  time
}: {
  at: number | null
  time: ReturnType<typeof useElapsedTime>
}): React.JSX.Element {
  if (at !== null && time !== null) {
    return (
      <time dateTime={new Date(at).toISOString()} {...stylex.props(styles.value)}>
        <span {...stylex.props(styles.number)}>{time.value}</span>
        {time.unit} 전
      </time>
    )
  }

  return (
    <span {...stylex.props(styles.value)}>
      <span {...stylex.props(styles.number)}>{MISSING_VALUE}</span>
    </span>
  )
}
