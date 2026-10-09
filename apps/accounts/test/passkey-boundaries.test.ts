import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes, randomUUID } from 'node:crypto'
import { parseCreation, parseExchange } from '../src/auth/login/input.js'
import { challenge, decodeOpaque, opaqueHash } from '../src/auth/login/crypto.js'
import {
  validatePasskeyConfiguration,
  configurationFingerprint,
  configuredLoginClient
} from '../src/auth/login/configuration.js'
import { createLoginHttpApp } from '../src/auth/login/http.js'
import { LoginFailure } from '../src/errors/login.js'

const opaque = () => randomBytes(32).toString('base64url')

const isInvalidInput = (error: unknown) => {
  assert.ok(error instanceof LoginFailure)
  assert.equal(error.code, 'INVALID_AUTH_REQUEST')
  assert.equal(error.status, 400)
  assert.equal(error.message, '인증 요청을 확인해 주세요.')
  assert.equal(Object.hasOwn(error, 'cause'), false)

  return true
}

test('패스키 생성은 등록된 client, S256, 정확한 필드만 받고 입력을 변경하지 않는다', async (t) => {
  const input = {
    provider: 'passkey',
    clientId: 'desktop',
    codeChallenge: opaque(),
    codeChallengeMethod: 'S256'
  }
  for (const clientId of ['desktop', 'ocr']) {
    const candidate = Object.freeze({ ...input, clientId })
    assert.deepEqual(parseCreation(candidate), candidate)
  }
  const withoutChallenge = {
    provider: input.provider,
    clientId: input.clientId,
    codeChallengeMethod: input.codeChallengeMethod
  }
  const cases = [
    { name: 'object가 아닌 입력', values: null },
    { name: 'array 입력', values: [input] },
    { name: '필수 필드 누락', values: withoutChallenge },
    {
      name: '임의 복귀 주소 추가',
      values: { ...input, redirectUri: 'https://attacker.invalid' }
    },
    { name: '종료된 외부 provider', values: { ...input, provider: 'google' } },
    { name: '미등록 client', values: { ...input, clientId: 'unregistered' } },
    { name: 'coercion이 필요한 client', values: { ...input, clientId: ['desktop'] } },
    { name: 'plain PKCE', values: { ...input, codeChallengeMethod: 'plain' } },
    {
      name: '비정규 base64url challenge',
      values: { ...input, codeChallenge: 'A'.repeat(42) + 'B' }
    }
  ]
  for (const { name, values } of cases) {
    await t.test(name, () => {
      const before = structuredClone(values)
      assert.throws(() => parseCreation(values), isInvalidInput)
      assert.deepEqual(values, before)
    })
  }
})

test('앱 교환 입력은 UUID, client 문자열, 32-byte 정규 proof와 정확한 필드를 요구한다', async (t) => {
  const input = {
    requestId: randomUUID(),
    clientId: 'desktop',
    code: opaque(),
    codeVerifier: opaque()
  }
  assert.deepEqual(parseExchange(Object.freeze(input)), input)
  const withoutVerifier = { requestId: input.requestId, clientId: input.clientId, code: input.code }
  const cases = [
    { name: 'object가 아닌 입력', values: null },
    { name: 'array 입력', values: [input] },
    { name: 'verifier 누락', values: withoutVerifier },
    { name: '임의 회원 ID 추가', values: { ...input, userId: randomUUID() } },
    { name: 'UUID가 아닌 requestId', values: { ...input, requestId: 'bad' } },
    { name: '문자열이 아닌 client', values: { ...input, clientId: ['desktop'] } },
    { name: '짧은 code', values: { ...input, code: 'A'.repeat(42) } },
    { name: 'padding을 포함한 code', values: { ...input, code: input.code + '=' } },
    { name: '비정규 verifier', values: { ...input, codeVerifier: 'A'.repeat(42) + 'B' } },
    { name: '문자열이 아닌 verifier', values: { ...input, codeVerifier: 42 } }
  ]
  for (const { name, values } of cases) {
    await t.test(name, () => {
      const before = structuredClone(values)
      assert.throws(() => parseExchange(values), isInvalidInput)
      assert.deepEqual(values, before)
    })
  }
})

test('S256은 RFC 7636의 독립 벡터를 따르고 opaque proof는 raw bytes로 해석한다', () => {
  // https://www.rfc-editor.org/rfc/rfc7636#appendix-B
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
  assert.equal(challenge(verifier), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  assert.deepEqual(
    decodeOpaque(verifier),
    Buffer.from([
      116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77,
      105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121
    ])
  )
  assert.notEqual(challenge(verifier), opaqueHash(verifier).toString('base64url'))
  for (const invalid of ['A'.repeat(42), 'A'.repeat(42) + 'B', verifier + '=', null, 42]) {
    assert.throws(() => decodeOpaque(invalid), isInvalidInput)
  }
})

test('RP origin과 고정 앱 복귀 설정의 신뢰 경계 변경을 거절한다', () => {
  const config = {
    apiOrigin: 'https://auth.example.test',
    rpId: 'auth.example.test',
    rpName: 'DFragon',
    returnUrl: 'dfragon://auth/callback'
  }
  assert.deepEqual(validatePasskeyConfiguration(config), config)
  assert.deepEqual(
    validatePasskeyConfiguration({ ...config, returnUrl: 'dfragon.dev://auth/callback' }),
    { ...config, returnUrl: 'dfragon.dev://auth/callback' }
  )
  for (const change of [
    { rpId: 'example.test' },
    { apiOrigin: 'http://auth.example.test' },
    { apiOrigin: 'https://auth.example.test/path' },
    { apiOrigin: 'https://user:password@auth.example.test' },
    { apiOrigin: 'https://auth.example.test/' },
    { apiOrigin: 'https://AUTH.example.test' },
    { returnUrl: 'https://attacker.invalid' },
    { returnUrl: 'other://auth/callback' },
    { returnUrl: 'dfragon://auth/callback?code=preselected' },
    { returnUrl: 'dfragon://user:password@auth/callback' },
    { returnUrl: 'dfragon://auth/callback#fragment' },
    { rpName: '' },
    { rpName: ' \t' },
    { rpName: 'x'.repeat(81) }
  ]) {
    assert.throws(() => validatePasskeyConfiguration({ ...config, ...change }), {
      message: 'Invalid passkey configuration'
    })
  }
})

test('클라이언트 제한 거절은 신뢰 proxy 뒤의 전체 인증 예산을 소모하지 않는다', async () => {
  const unused = async (): Promise<never> => {
    throw new Error('unused')
  }
  const app = await createLoginHttpApp(
    {
      create: async () => ({
        requestId: 'test',
        browserUrl: 'https://test.invalid',
        expiresAt: '2030-01-01T00:00:00Z'
      }),
      authorize: unused,
      exchange: unused,
      manage: unused,
      browser: unused
    },
    undefined,
    undefined,
    { trustedProxyHops: 1 }
  )
  try {
    await app.listen(0, '127.0.0.1')
    const base = await app.getUrl()
    const body = JSON.stringify({
      provider: 'passkey',
      clientId: 'desktop',
      codeChallenge: opaque(),
      codeChallengeMethod: 'S256'
    })
    const request = (ip: string) =>
      fetch(`${base}/auth/login-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
        body
      })
    for (let i = 0; i < 1201; i++) {
      const response = await request('192.0.2.1')
      assert.equal(response.status, i < 120 ? 201 : 429)
      await response.arrayBuffer()
    }
    const other = await request('192.0.2.2')
    assert.equal(other.status, 201)
    await other.arrayBuffer()
  } finally {
    await app.close()
  }
})

test('고정 HTTPS OCR callback 설정은 Desktop 요청 바인딩을 바꾸지 않는다', () => {
  const base = {
    apiOrigin: 'https://auth.example.test',
    rpId: 'auth.example.test',
    rpName: 'DFragon',
    returnUrl: 'dfragon://auth/callback'
  }
  const config = validatePasskeyConfiguration({
    ...base,
    ocrReturnUrl: 'https://ocr.example.test/auth/callback'
  })
  const desktop = configurationFingerprint(base)
  assert.equal(configurationFingerprint(config), desktop)
  const ocr = configurationFingerprint(config, 'ocr')
  assert.notEqual(ocr, desktop)
  assert.equal(configuredLoginClient(config, ocr), 'ocr')
  assert.equal(configuredLoginClient(base, ocr), null)
  assert.equal(
    configuredLoginClient(
      { ...config, ocrReturnUrl: 'https://other.example.test/auth/callback' },
      ocr
    ),
    null
  )
  for (const ocrReturnUrl of [
    'http://ocr.example.test/auth/callback',
    'https://ocr.example.test/elsewhere',
    'https://ocr.example.test/auth/callback?x=1',
    'https://user@ocr.example.test/auth/callback',
    'https://ocr.example.test/auth/callback#x'
  ]) {
    assert.throws(() => validatePasskeyConfiguration({ ...base, ocrReturnUrl }))
  }
})
