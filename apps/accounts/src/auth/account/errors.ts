import { AUTH_ERRORS } from '../../constants/auth.js'
import { LOGIN_ERRORS } from '../../constants/login.js'
import { type FailureOptions, SanitizedFailure } from '../../error-chain.js'

type AccountErrorDefinitionShape = Readonly<{
  code: string
  status: number
  message: string
}>

export const ACCOUNT_ERRORS = {
  ...AUTH_ERRORS,
  INVALID_REQUEST: LOGIN_ERRORS.INVALID_REQUEST,
  AUTHENTICATION_REQUIRED: {
    code: 'AUTHENTICATION_REQUIRED',
    status: 401,
    message: '로그인이 필요합니다.'
  },
  INVALID_NICKNAME: {
    code: 'INVALID_NICKNAME',
    status: 400,
    message: '닉네임을 확인해 주세요.'
  }
} as const satisfies Record<string, AccountErrorDefinitionShape>

export type AccountErrorDefinition = (typeof ACCOUNT_ERRORS)[keyof typeof ACCOUNT_ERRORS]

export class AccountFailure extends SanitizedFailure {
  readonly code: AccountErrorDefinition['code']
  readonly status: AccountErrorDefinition['status']

  constructor(definition: AccountErrorDefinition, options?: FailureOptions) {
    super(definition.message, options)
    this.name = 'AccountFailure'
    this.code = definition.code
    this.status = definition.status
    this.stack = `${this.name}: ${this.message}`
  }
}
