import { TodayGradeFailure, todayGradeFailure } from './errors.js'
import { averageGradePercent, nextGradeResetAt } from './grade.js'
import { TODAY_GRADE_ITEMS } from './items.js'
import type { FetchShopGrade } from './neople.js'

export interface TodayGrade {
  percent: number
  expiresAt: string
}

function waitForAbort(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

export function createTodayGradeService(
  fetchShopGrade: FetchShopGrade,
  now: () => Date = () => new Date()
) {
  const shutdown = new AbortController()
  let cached: TodayGrade | undefined
  let loading: Promise<TodayGrade> | undefined

  const load = async (): Promise<TodayGrade> => {
    // 0시 직전에 시작한 조회는 전날 등급을 받았을 수 있으므로 시작 시각으로 만료를 정한다.
    const startedAt = now()
    const failure = new AbortController()
    const signal = AbortSignal.any([shutdown.signal, failure.signal])
    try {
      const values = await Promise.all(
        TODAY_GRADE_ITEMS.map(({ itemId }) => fetchShopGrade(itemId, signal))
      )
      shutdown.signal.throwIfAborted()
      const grade = {
        percent: averageGradePercent(values),
        expiresAt: nextGradeResetAt(startedAt).toISOString()
      }
      cached = grade

      return grade
    } catch (error) {
      failure.abort()
      throw error
    }
  }

  return {
    async get(requestSignal: AbortSignal): Promise<TodayGrade> {
      try {
        requestSignal.throwIfAborted()
        const current = cached
        if (current !== undefined && now().getTime() < Date.parse(current.expiresAt)) {
          return current
        }
        // 여러 요청이 한 조회를 함께 기다리므로 요청 하나의 연결 종료로 조회를 취소하지 않는다.
        loading ??= load().finally(() => {
          loading = undefined
        })
        const grade = await Promise.race([loading, waitForAbort(requestSignal)])
        if (grade === undefined) {
          throw new TodayGradeFailure('internal')
        }

        return grade
      } catch (error) {
        throw todayGradeFailure(error)
      }
    },
    async onModuleDestroy() {
      shutdown.abort()
      await loading?.catch(() => undefined)
    }
  }
}

export type TodayGradeService = ReturnType<typeof createTodayGradeService>
