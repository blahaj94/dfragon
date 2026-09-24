import { createHash } from 'node:crypto'
import type { PasskeyConfiguration } from '../../types/login.js'

export function validatePasskeyConfiguration(
  value: PasskeyConfiguration
): Readonly<PasskeyConfiguration> {
  try {
    const origin = new URL(value.apiOrigin)
    const target = new URL(value.returnUrl)
    if (
      origin.protocol !== 'https:' ||
      origin.origin !== value.apiOrigin ||
      origin.hostname !== value.rpId ||
      !value.rpName.trim() ||
      value.rpName.length > 80
    ) {
      throw new Error()
    }
    if (
      !['dfragon:', 'dfragon.dev:'].includes(target.protocol) ||
      target.host !== 'auth' ||
      target.pathname !== '/callback' ||
      target.search ||
      target.hash ||
      target.username ||
      target.password ||
      target.href !== value.returnUrl
    ) {
      throw new Error()
    }
    return Object.freeze({ ...value })
  } catch {
    throw new Error('Invalid passkey configuration')
  }
}

export function configurationFingerprint(config: PasskeyConfiguration): string {
  return createHash('sha256')
    .update(JSON.stringify([config.apiOrigin, config.rpId, config.rpName, config.returnUrl]))
    .digest('hex')
}
