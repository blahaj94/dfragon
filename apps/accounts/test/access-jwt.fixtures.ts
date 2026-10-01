import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { CompactSign, importPKCS8 } from 'jose'

// Test 실행 동안만 생성하며 key/token을 file이나 log에 남기지 않는다.
export function keyPair(kid: string = randomUUID(), namedCurve = 'prime256v1') {
  const pair = generateKeyPairSync('ec', {
    namedCurve,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  })

  return { kid, privateKeyPem: pair.privateKey, publicKeyPem: pair.publicKey }
}

export const active = keyPair()
export const previous = keyPair()
export const now = 1_800_000_000
export const userId = randomUUID()
export const sessionId = randomUUID()
export const tokenId = randomUUID()
export const configuration = () => {
  const signingKey = { kid: active.kid, privateKeyPem: active.privateKeyPem }
  const verificationKeys = [active, previous].map(({ kid, publicKeyPem }) => ({ kid, publicKeyPem }))

  return {
    issuer: 'urn:dfragon:test:issuer',
    audience: 'urn:dfragon:test:api',
    signingKey,
    verificationKeys
  }
}
export const input = () => {
  const idleDeadline = now + 2_592_000

  return { userId, sessionId, issuedAt: now, idleDeadline }
}
export const claims = (): Record<string, unknown> => {
  const issuer = configuration().issuer
  const audience = configuration().audience
  const expiresAt = now + 900

  return {
    iss: issuer,
    aud: audience,
    sub: userId,
    sid: sessionId,
    iat: now,
    exp: expiresAt,
    jti: tokenId
  }
}
export const header = (): { alg: string; [key: string]: unknown } => ({
  alg: 'ES256',
  typ: 'at+jwt',
  kid: active.kid
})

export async function signed(
  payload: unknown = claims(),
  protectedHeader = header(),
  pair = active
) {

  return new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader(protectedHeader)
    .sign(await importPKCS8(pair.privateKeyPem, 'ES256'))
}
