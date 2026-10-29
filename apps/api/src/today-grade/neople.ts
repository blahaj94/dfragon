import { isRecord } from '@dfragon/lib/utils/shape-check'
import ky, { isTimeoutError } from 'ky'
import { NEOPLE_ORIGIN } from '../constants/neople-character-search.js'
import { classifyNeopleUpstreamFailure, neopleStatusFailureKind } from '../errors/neople-search.js'
import type { FetchTransport } from '../types/neople-character-search.js'
import { TodayGradeFailure } from './errors.js'

export type FetchShopGrade = (itemId: string, signal: AbortSignal) => Promise<number>

function readGradeValue(rawBody: string, status: number, ok: boolean): number {
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch (error) {
    throw new TodayGradeFailure(neopleStatusFailureKind(status), { cause: error })
  }
  const failure = classifyNeopleUpstreamFailure(body, status, ok)
  if (failure) {
    throw new TodayGradeFailure(failure)
  }
  const value = isRecord(body) ? body.itemGradeValue : undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new TodayGradeFailure('api')
  }

  return value
}

export function createNeopleShopGrade(apiKey: string, fetchImpl?: FetchTransport): FetchShopGrade {
  const neople = ky.create({
    baseUrl: NEOPLE_ORIGIN,
    fetch: fetchImpl,
    headers: { apikey: apiKey },
    redirect: 'error',
    retry: 0,
    throwHttpErrors: false
  })

  return async (itemId, signal) => {
    try {
      return await neople
        .get(`/df/items/${encodeURIComponent(itemId)}/shop`, {
          signal,
          parseJson: (rawBody, { response }) =>
            readGradeValue(rawBody, response.status, response.ok)
        })
        .json<number>()
    } catch (error) {
      if (error instanceof TodayGradeFailure) {
        throw error
      }

      if (isTimeoutError(error)) {
        throw new TodayGradeFailure('timeout', { cause: error })
      }
      throw new TodayGradeFailure('api', { cause: error })
    }
  }
}
