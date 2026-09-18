import { AuthHttpFailure } from './http'
import type { AuthNotice } from './types'

type VerificationFailureNotice = Extract<
  AuthNotice,
  'REAUTH_REQUIRED' | 'NETWORK_UNAVAILABLE' | 'AUTH_SERVICE_UNAVAILABLE'
>

export function verificationFailureNotice(error: unknown): VerificationFailureNotice {
  const isHttpFailure = error instanceof AuthHttpFailure
  if (!isHttpFailure) {
    return 'AUTH_SERVICE_UNAVAILABLE'
  }

  const needsAuthentication = error.code === 'authentication-required'
  if (needsAuthentication) {
    return 'REAUTH_REQUIRED'
  }

  const isNetwork = error.code === 'network'
  return isNetwork ? 'NETWORK_UNAVAILABLE' : 'AUTH_SERVICE_UNAVAILABLE'
}
