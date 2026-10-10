import { AUTH_ERRORS } from '../../constants/auth.js'
import { type FailureOptions, SanitizedFailure } from '../../error-chain.js'

type LogoutErrorDefinitionShape = Readonly<{
  code: string
  status: number
  message: string
}>

export const LOGOUT_ERRORS = {
  UNAVAILABLE: AUTH_ERRORS.UNAVAILABLE
} as const satisfies Record<string, LogoutErrorDefinitionShape>

export type LogoutErrorDefinition = (typeof LOGOUT_ERRORS)[keyof typeof LOGOUT_ERRORS]

export class LogoutFailure extends SanitizedFailure {
  readonly code: LogoutErrorDefinition['code']
  readonly status: LogoutErrorDefinition['status']

  constructor(definition: LogoutErrorDefinition, options?: FailureOptions) {
    super(definition.message, options)
    this.name = 'LogoutFailure'
    this.code = definition.code
    this.status = definition.status
    this.stack = `${this.name}: ${this.message}`
  }
}
