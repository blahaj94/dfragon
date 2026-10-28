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
  const elapsed = at === null || time === null ? null : { at, ...time }

  return (
    <div {...stylex.props(styles.root)}>
      <span>
        <span {...stylex.props(styles.label)}>마지막 캡처</span>
        {elapsed === null ? (
          <span {...stylex.props(styles.value)}>
            <span {...stylex.props(styles.number)}>{MISSING_VALUE}</span>
          </span>
        ) : (
          <time dateTime={new Date(elapsed.at).toISOString()} {...stylex.props(styles.value)}>
            <span {...stylex.props(styles.number)}>{elapsed.value}</span>
            {elapsed.unit} 전
          </time>
        )}
      </span>
    </div>
  )
}
