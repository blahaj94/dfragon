import { useEffect, useState } from 'react'
import { type ElapsedTime, getElapsedTimeRefreshDelay, toElapsedTime } from '../lib/elapsed-time'

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
