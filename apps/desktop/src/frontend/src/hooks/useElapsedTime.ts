import { useEffect, useState } from 'react'
import { type ElapsedTime, getElapsedTimeRefreshDelay, toElapsedTime } from '../lib/elapsed-time'

export function useElapsedTime(at: number): ElapsedTime {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), getElapsedTimeRefreshDelay(now - at))

    return () => window.clearTimeout(timer)
  }, [at, now])

  return toElapsedTime(now - at)
}
