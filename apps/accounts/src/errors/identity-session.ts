import type { AuthErrorCode, AuthErrorDefinition } from '../types/auth.js'
import { type FailureOptions, SanitizedFailure } from '../error-chain.js'

export class IdentitySessionFailure extends SanitizedFailure {
  readonly code: AuthErrorCode
  readonly status: AuthErrorDefinition['status']

  constructor(definition: AuthErrorDefinition, options?: FailureOptions) {
    super(definition.message, options)
    this.name = 'IdentitySessionFailure'
    this.code = definition.code
    this.status = definition.status
  }
}
