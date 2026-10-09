import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { inspect } from 'node:util'
import { test } from 'node:test'
import { decodeJwt, decodeProtectedHeader } from 'jose'
import { createAccessJwtIssuer, createAccessJwtVerifier } from '../src/auth/access-jwt/index.js'
import { AccessJwtError } from '../src/auth/access-jwt/errors.js'
import type {
  AccessJwtIssuerConfiguration,
  AccessJwtVerifierConfiguration
} from '../src/auth/access-jwt/types.js'
import { active, configuration, input, keyPair, now, previous } from './access-jwt.fixtures.js'

function sanitized(error: unknown) {
  const isAccessJwtError = error instanceof AccessJwtError
  assert.ok(isAccessJwtError)
  assert.equal(error.code, 'INVALID_ACCESS_JWT_CONFIGURATION')
  assert.equal(error.message, 'Invalid access JWT configuration')
  const hasNoCause = !Object.hasOwn(error, 'cause')
  assert.ok(hasNoCause)
  for (const secret of [active.privateKeyPem, previous.privateKeyPem, 'sensitive-invalid-key']) {
    const isInspectedErrorSanitized = !inspect(error).includes(secret)
    assert.ok(isInspectedErrorSanitized)
    const isSerializedErrorSanitized = !JSON.stringify(error).includes(secret)
    assert.ok(isSerializedErrorSanitized)
  }

  return true
}

test('public key만으로 verifier를 초기화하며 key/issuer 설정은 초기화 뒤 고정된다', async () => {
  const config = configuration()
  const publicConfig = {
    issuer: config.issuer,
    audience: config.audience,
    verificationKeys: config.verificationKeys
  }
  const verify = await createAccessJwtVerifier(publicConfig)
  const issue = await createAccessJwtIssuer(config)
  config.issuer = 'changed'
  config.audience = 'changed'
  config.signingKey.kid = 'changed'
  config.signingKey.privateKeyPem = 'sensitive-invalid-key'
  config.verificationKeys[0].publicKeyPem = 'sensitive-invalid-key'
  config.verificationKeys.length = 0
  const result = await issue(input())
  assert.equal(decodeProtectedHeader(result.accessToken).kid, active.kid)
  assert.equal(decodeJwt(result.accessToken).iss, publicConfig.issuer)
  await verify(result.accessToken, now)
})

test('누락/빈 issuer, audience, key 목록과 중복/빈 kid를 초기화에서 거절한다', async () => {
  const config = configuration()
  const cases: unknown[] = [
    undefined,
    null,
    {},
    { ...config, issuer: '' },
    { ...config, issuer: 42 },
    { ...config, audience: '' },
    { ...config, audience: ['api'] },
    { ...config, verificationKeys: [] },
    { ...config, verificationKeys: undefined },
    { ...config, verificationKeys: [config.verificationKeys[0], config.verificationKeys[0]] },
    { ...config, verificationKeys: [{ ...config.verificationKeys[0], kid: '' }] },
    { ...config, verificationKeys: [{ ...config.verificationKeys[0], kid: 42 }] },
    { ...config, verificationKeys: [null] },
    { ...config, verificationKeys: [{ kid: active.kid }] },
    { ...config, verificationKeys: [{ kid: active.kid, publicKeyPem: 'sensitive-invalid-key' }] },
    { ...config, signingKey: undefined },
    { ...config, signingKey: { kid: 'unknown', privateKeyPem: active.privateKeyPem } },
    { ...config, signingKey: { kid: active.kid, privateKeyPem: 'sensitive-invalid-key' } }
  ]
  for (const candidate of cases) {
    await assert.rejects(
      createAccessJwtIssuer(candidate as AccessJwtIssuerConfiguration),
      sanitized
    )
  }
  await assert.rejects(
    createAccessJwtVerifier(undefined as unknown as AccessJwtVerifierConfiguration),
    sanitized
  )
  await assert.rejects(createAccessJwtVerifier({ ...config, verificationKeys: [] }), sanitized)
})

test('public verifier도 빈 신뢰 설정, 중복 kid, 비활성 잘못된 key를 독립적으로 거절한다', async (t) => {
  const config = configuration()
  const cases = [
    { name: '공백 issuer', values: { issuer: ' \t' } },
    { name: '공백 audience', values: { audience: ' \n' } },
    { name: '공백 kid', values: { verificationKeys: [{ ...active, kid: ' \t' }] } },
    { name: '중복 kid', values: { verificationKeys: [active, active] } },
    {
      name: '잘못된 이전 key',
      values: {
        verificationKeys: [active, { kid: 'old-broken', publicKeyPem: 'sensitive-invalid-key' }]
      }
    }
  ]
  for (const { name, values } of cases) {
    await t.test(name, async () => {
      await assert.rejects(createAccessJwtVerifier({ ...config, ...values }), sanitized)
    })
  }
})

test('정상 key 교체는 두 token의 겹침 기간을 허용하고 이전 token 만료 뒤 제거한다', async () => {
  const oldConfig = configuration()
  oldConfig.signingKey = { kid: previous.kid, privateKeyPem: previous.privateKeyPem }
  oldConfig.verificationKeys = [{ kid: previous.kid, publicKeyPem: previous.publicKeyPem }]
  const oldIssue = await createAccessJwtIssuer(oldConfig)
  const oldToken = await oldIssue(input())

  const overlap = await createAccessJwtVerifier(configuration())
  const newIssue = await createAccessJwtIssuer(configuration())
  const newToken = await newIssue({ ...input(), issuedAt: now + 300 })
  assert.equal(decodeProtectedHeader(oldToken.accessToken).kid, previous.kid)
  assert.equal(decodeProtectedHeader(newToken.accessToken).kid, active.kid)
  assert.equal((await overlap(oldToken.accessToken, now + 300)).expiresAt, now + 900)
  assert.equal((await overlap(newToken.accessToken, now + 300)).expiresAt, now + 1200)
  await assert.rejects(overlap(oldToken.accessToken, now + 900), { code: 'INVALID_ACCESS_JWT' })

  const newOnlyConfig = configuration()
  newOnlyConfig.verificationKeys = [{ kid: active.kid, publicKeyPem: active.publicKeyPem }]
  const newOnly = await createAccessJwtVerifier(newOnlyConfig)
  await assert.rejects(newOnly(oldToken.accessToken, now + 900), { code: 'INVALID_ACCESS_JWT' })
  assert.deepEqual(await newOnly(newToken.accessToken, now + 900), {
    userId: input().userId,
    sessionId: input().sessionId,
    issuedAt: now + 300,
    expiresAt: now + 1200,
    tokenId: decodeJwt(newToken.accessToken).jti
  })
})

test('private/public mismatch, 잘못된 curve, RSA, key 역할 혼동은 초기화 실패다', async () => {
  const config = configuration()
  const p384 = keyPair(undefined, 'secp384r1')
  const rsa = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
  })
  for (const privateKeyPem of [
    previous.privateKeyPem,
    p384.privateKeyPem,
    rsa.privateKey,
    active.publicKeyPem,
    ''
  ]) {
    await assert.rejects(
      createAccessJwtIssuer({
        ...config,
        signingKey: { kid: active.kid, privateKeyPem }
      }),
      sanitized
    )
  }
  for (const publicKeyPem of [p384.publicKeyPem, rsa.publicKey, active.privateKeyPem, '']) {
    const candidate = { ...config, verificationKeys: [{ kid: active.kid, publicKeyPem }] }
    await assert.rejects(createAccessJwtVerifier(candidate), sanitized)
    await assert.rejects(createAccessJwtIssuer(candidate), sanitized)
  }
  // 비활성 verify key도 listen 전에 모두 검증한다.
  await assert.rejects(
    createAccessJwtIssuer({
      ...config,
      verificationKeys: [
        ...config.verificationKeys,
        { kid: 'old-broken', publicKeyPem: 'sensitive-invalid-key' }
      ]
    }),
    sanitized
  )
})
