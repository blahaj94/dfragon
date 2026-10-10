import { NeopleSearchFailure } from '../../errors/neople-search.js'
import { type FailureOptions, SanitizedFailure } from '../../error-chain.js'

const failures = {
  query: {
    status: 400,
    code: 'INVALID_CHARACTER_QUERY',
    message: '캐릭터 조회 조건을 확인해 주세요.'
  },
  limited: {
    status: 429,
    code: 'CHARACTER_RATE_LIMITED',
    message: '캐릭터 조회 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  },
  internal: {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: '서버 오류로 캐릭터 정보를 처리하지 못했습니다.'
  },
  api: {
    status: 502,
    code: 'NEOPLE_API_ERROR',
    message: '캐릭터 정보 조회 중 오류가 발생했습니다.'
  },
  unavailable: {
    status: 503,
    code: 'NEOPLE_UNAVAILABLE',
    message: '현재 캐릭터 정보를 조회할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  },
  timeout: {
    status: 504,
    code: 'NEOPLE_TIMEOUT',
    message: '캐릭터 정보 조회 시간이 초과됐습니다. 다시 시도해 주세요.'
  }
} as const

type CharacterDetailFailureOptions = FailureOptions & { retryAfter?: number }

export class CharacterDetailFailure extends SanitizedFailure {
  readonly body: { error: { code: string; message: string } }
  readonly status: number
  readonly retryAfter: number | undefined

  constructor(kind: keyof typeof failures, options: CharacterDetailFailureOptions = {}) {
    const definition = failures[kind]
    super(definition.message, options)
    this.retryAfter = options.retryAfter
    this.name = 'CharacterDetailFailure'
    this.status = definition.status
    this.body = { error: { code: definition.code, message: definition.message } }
  }
}

export function characterDetailFailure(error: unknown): CharacterDetailFailure {
  if (error instanceof CharacterDetailFailure) {
    return error
  }

  if (error instanceof NeopleSearchFailure) {
    let kind: keyof typeof failures = 'internal'
    if (error.status === 429) {
      kind = 'limited'
    } else if (error.status === 503) {
      kind = 'unavailable'
    } else if (error.status === 504) {
      kind = 'timeout'
    } else if (error.status === 502) {
      kind = 'api'
    }

    return new CharacterDetailFailure(kind, { retryAfter: error.retryAfter, cause: error })
  }

  return new CharacterDetailFailure('internal', { cause: error })
}
