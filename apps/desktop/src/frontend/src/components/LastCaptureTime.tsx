import { useEffect, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { MISSING_VALUE } from '../constants/cards'
import { toElapsedTime, getElapsedTimeRefreshDelay } from '../lib/elapsed-time'
import { styles } from './LastCaptureTime.style'

/**
 * 파티 머리의 마지막 캡처 상대 시간. 표시 값이 바뀔 때만 이 요소를 다시 그리고, 완료 시각이 없으면 `-`다.
 * 화면은 완료 시각이 바뀔 때마다 `key`로 새로 그려 현재 시각을 그 순간부터 다시 잰다.
 */
export function LastCaptureTime({ at }: { at: number | null }): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (at === null) {
      return
    }
    const timer = window.setTimeout(() => setNow(Date.now()), getElapsedTimeRefreshDelay(now - at))

    return () => window.clearTimeout(timer)
  }, [at, now])

  const elapsed = at === null ? null : { at, ...toElapsedTime(now - at) }

  return (
    <div {...stylex.props(styles.root)}>
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
    </div>
  )
}
