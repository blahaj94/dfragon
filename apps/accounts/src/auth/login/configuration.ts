import { createHash } from 'node:crypto'
import type { PasskeyConfiguration } from '../../types/login.js'

export function validatePasskeyConfiguration(
  value: PasskeyConfiguration
): Readonly<PasskeyConfiguration> {
  try {
    const origin = new URL(value.apiOrigin)
    if (
      origin.protocol !== 'https:' ||
      origin.origin !== value.apiOrigin ||
      origin.hostname !== value.rpId ||
      !value.rpName.trim() ||
      value.rpName.length > 80
    ) {
      throw new Error()
    }

    if (value.ocrReturnUrl !== undefined) {
      const web = new URL(value.ocrReturnUrl)
      if (
        web.protocol !== 'https:' ||
        web.pathname !== '/auth/callback' ||
        web.username ||
        web.password ||
        web.search ||
        web.hash ||
        web.href !== value.ocrReturnUrl
      ) {
        throw new Error()
      }
    }

    return Object.freeze({ ...value })
  } catch {
    throw new Error('Invalid passkey configuration')
  }
}

/** 설정 변경을 감지한다. 요청별 Desktop 주소는 요청 행에 별도로 보관한다. */
export function configurationFingerprint(
  config: PasskeyConfiguration,
  clientId: 'desktop' | 'ocr' = 'desktop'
): string {
  const values = [config.apiOrigin, config.rpId, config.rpName]
  if (clientId === 'ocr') {
    if (config.ocrReturnUrl === undefined) {
      throw new Error('OCR login is not configured')
    }
    values.push('ocr', config.ocrReturnUrl)
  }

  return createHash('sha256').update(JSON.stringify(values)).digest('hex')
}

export function configuredLoginClient(
  config: PasskeyConfiguration,
  fingerprint: string
): 'desktop' | 'ocr' | null {
  if (fingerprint === configurationFingerprint(config)) {
    return 'desktop'
  }

  if (
    config.ocrReturnUrl !== undefined &&
    fingerprint === configurationFingerprint(config, 'ocr')
  ) {
    return 'ocr'
  }

  return null
}
