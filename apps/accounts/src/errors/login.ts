import { LOGIN_ERRORS } from '../constants/login.js'
import { IdentitySessionFailure } from './identity-session.js'
import type { LoginErrorDefinition } from '../types/login.js'
import { type FailureOptions, SanitizedFailure } from '../error-chain.js'

export class LoginFailure extends SanitizedFailure {
  readonly code: LoginErrorDefinition['code']
  readonly status: LoginErrorDefinition['status']

  constructor(definition: LoginErrorDefinition, options?: FailureOptions) {
    super(definition.message, options)
    this.name = 'LoginFailure'
    this.code = definition.code
    this.status = definition.status
    this.stack = `${this.name}: ${this.message}`
  }
}

export function loginFailure(
  error: unknown,
  fallback: LoginErrorDefinition = LOGIN_ERRORS.INTERNAL
): LoginFailure {
  const isLoginFailure = error instanceof LoginFailure
  if (isLoginFailure) {
    return error
  }

  const isIdentitySessionFailure = error instanceof IdentitySessionFailure
  if (isIdentitySessionFailure) {
    const isUnavailable = error.code === LOGIN_ERRORS.UNAVAILABLE.code
    const definition = isUnavailable ? LOGIN_ERRORS.UNAVAILABLE : LOGIN_ERRORS.INTERNAL

    return new LoginFailure(definition, { cause: error })
  }

  return new LoginFailure(fallback, { cause: error })
}
