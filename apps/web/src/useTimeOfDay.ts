import { readTimeOfDay, type TimeOfDay } from '@dfragon/desktop-site/time-of-day'
import { useEffect, useState } from 'react'

const CHECK_INTERVAL_MS = 60_000

export function useTimeOfDay(): TimeOfDay {
  const [timeOfDay, setTimeOfDay] = useState(() => readTimeOfDay(new Date().getHours()))

  useEffect(() => {
    const timer = window.setInterval(
      () => setTimeOfDay(readTimeOfDay(new Date().getHours())),
      CHECK_INTERVAL_MS
    )

    return () => window.clearInterval(timer)
  }, [])

  return timeOfDay
}
