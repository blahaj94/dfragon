import ky from 'ky'
import { parseTodayGrade } from '../../preload/common/today-grade'
import type { TodayGrade } from '../../preload/common/types/today-grade'

// 응답은 `{ percent, expiresAt }` 하나라 100바이트 안팎이다.
const TODAY_GRADE_MAX_BYTES = 4 * 1024

export async function readTodayGrade(
  apiOrigin: string,
  transport: typeof fetch
): Promise<TodayGrade> {
  const body = await ky
    .get(new URL('/items/today-grade', apiOrigin), {
      fetch: transport,
      retry: 0,
      maxResponseSize: TODAY_GRADE_MAX_BYTES,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store'
    })
    .json()
  const grade = parseTodayGrade(body)
  if (grade == null) {
    throw new Error('INVALID_TODAY_GRADE_RESPONSE')
  }

  return grade
}
