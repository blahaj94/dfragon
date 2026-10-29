import { useEffect, useState } from 'react'
import type { TodayGrade } from '../../../preload/common/types/today-grade'

// PC 시계가 API 서버보다 빠르면 만료가 이미 지난 값을 다시 받으므로, 다시 받는 간격을 1분 아래로 줄이지 않는다.
const MIN_REFRESH_DELAY_MS = 60 * 1000

export function useTodayGrade(): number | null {
  const [grade, setGrade] = useState<TodayGrade | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    window.todayGrade.getTodayGrade().then(
      (next) => {
        if (active) {
          setGrade(next)
        }
      },
      () => {
        if (active) {
          setGrade(null)
        }
      }
    )

    return () => {
      active = false
    }
  }, [revision])

  useEffect(() => {
    if (grade == null) {
      return
    }
    // 등급은 매일 0시(KST)에 바뀌므로 API가 준 만료 시각에 다시 받는다.
    const timer = window.setTimeout(
      () => setRevision((current) => current + 1),
      Math.max(MIN_REFRESH_DELAY_MS, Date.parse(grade.expiresAt) - Date.now())
    )

    return () => window.clearTimeout(timer)
  }, [grade])

  if (grade == null) {
    return null
  }

  return grade.percent
}
