import { type FailureOptions, SanitizedFailure } from '../../error-chain.js'

const messages = {
  INVALID_ACCESS_JWT_CONFIGURATION: 'Invalid access JWT configuration',
  INVALID_ACCESS_JWT_INPUT: 'Invalid access JWT input',
  INVALID_ACCESS_JWT: 'Invalid access JWT',
  ACCESS_JWT_SIGNING_FAILED: 'Access JWT signing failed'
} as const satisfies Record<string, string>

export class AccessJwtError extends SanitizedFailure {
  constructor(
    readonly code: keyof typeof messages,
    options?: FailureOptions
  ) {
    super(messages[code], options)
    this.name = 'AccessJwtError'
  }
}
