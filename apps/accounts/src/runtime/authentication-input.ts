import type { AccessJwtIssuerConfiguration } from '../auth/access-jwt/types.js'

const invalidConfiguration = 'Invalid authentication configuration'

function record(value: unknown, fields: readonly string[]): Record<string, unknown> {
  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value)
  if (!isObject) {
    throw new Error(invalidConfiguration)
  }
  const hasExpectedCount = Object.keys(value).length === fields.length
  const hasRequiredFields = fields.every((field) => {
    const hasField = Object.hasOwn(value, field)
    return hasField
  })
  const hasExactFields = hasExpectedCount && hasRequiredFields
  if (!hasExactFields) {
    throw new Error(invalidConfiguration)
  }
  // JSON object와 정확한 field 집합을 확인했다. 각 값의 type은 아래 경계에서 검사한다.
  return value as Record<string, unknown>
}

function text(value: unknown): string {
  const isString = typeof value === 'string'
  if (!isString) {
    throw new Error(invalidConfiguration)
  }
  return value
}

function array(value: unknown): unknown[] {
  const isArray = Array.isArray(value)
  if (!isArray) {
    throw new Error(invalidConfiguration)
  }
  return value
}

function accessJwt(value: unknown): AccessJwtIssuerConfiguration {
  const input = record(value, ['issuer', 'audience', 'signingKey', 'verificationKeys'])
  const signing = record(input.signingKey, ['kid', 'privateKeyPem'])
  return {
    issuer: text(input.issuer),
    audience: text(input.audience),
    signingKey: { kid: text(signing.kid), privateKeyPem: text(signing.privateKeyPem) },
    verificationKeys: array(input.verificationKeys).map((value) => {
      const key = record(value, ['kid', 'publicKeyPem'])
      return { kid: text(key.kid), publicKeyPem: text(key.publicKeyPem) }
    })
  }
}

/** Runtime config accepts only access JWT and fixed passkey client settings. */
export function parseAuthenticationInput(value: unknown) {
  const input = record(value, ['accessJwt', 'passkey'])
  const hasOcr =
    typeof input.passkey === 'object' &&
    input.passkey !== null &&
    Object.hasOwn(input.passkey, 'ocrReturnUrl')
  const passkey = record(input.passkey, [
    'apiOrigin',
    'rpId',
    'rpName',
    'returnUrl',
    ...(hasOcr ? ['ocrReturnUrl'] : [])
  ])
  return {
    accessJwt: accessJwt(input.accessJwt),
    passkey: {
      apiOrigin: text(passkey.apiOrigin),
      rpId: text(passkey.rpId),
      rpName: text(passkey.rpName),
      returnUrl: text(passkey.returnUrl),
      ...(hasOcr ? { ocrReturnUrl: text(passkey.ocrReturnUrl) } : {})
    }
  }
}
