import { useEffect, useState } from 'react'
import { type ElapsedTime, getElapsedTimeRefreshDelay, toElapsedTime } from '../lib/elapsed-time'

/**
 * 시각 `at`(ms)부터 지난 시간을 가장 큰 단위 하나로 돌려주고, 표시 값이 바뀔 때만 다시 그린다. `at`이 없으면
 * null이다. 호출한 화면은 `at`이 바뀔 때 `key`로 새로 그려 현재 시각을 그 순간부터 다시 잰다.
 */
export function useElapsedTime(at: number | null): ElapsedTime | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (at === null) {
      return
    }
    const timer = window.setTimeout(() => setNow(Date.now()), getElapsedTimeRefreshDelay(now - at))

    return () => window.clearTimeout(timer)
  }, [at, now])

  if (at === null) {
    return null
  }

  return toElapsedTime(now - at)
}
