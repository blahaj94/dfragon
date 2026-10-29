import { type FailureOptions, SanitizedFailure } from '../error-chain.js'

const failures = {
  internal: {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: '서버 오류로 오늘의 등급을 처리하지 못했습니다.'
  },
  api: {
    status: 502,
    code: 'NEOPLE_API_ERROR',
    message: '오늘의 등급 조회 중 오류가 발생했습니다.'
  },
  unavailable: {
    status: 503,
    code: 'NEOPLE_UNAVAILABLE',
    message: '현재 오늘의 등급을 조회할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  },
  timeout: {
    status: 504,
    code: 'NEOPLE_TIMEOUT',
    message: '오늘의 등급 조회 시간이 초과됐습니다. 다시 시도해 주세요.'
  }
} as const

export class TodayGradeFailure extends SanitizedFailure {
  readonly body: { error: { code: string; message: string } }
  readonly status: number

  constructor(kind: keyof typeof failures, options: FailureOptions = {}) {
    const definition = failures[kind]
    super(definition.message, options)
    this.name = 'TodayGradeFailure'
    this.status = definition.status
    this.body = { error: { code: definition.code, message: definition.message } }
  }
}

export function todayGradeFailure(error: unknown): TodayGradeFailure {
  if (error instanceof TodayGradeFailure) {
    return error
  }

  return new TodayGradeFailure('internal', { cause: error })
}
