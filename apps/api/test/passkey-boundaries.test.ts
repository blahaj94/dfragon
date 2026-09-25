import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'node:crypto'
import { parseCreation, parseExchange } from '../src/auth/login/input.js'
import { challenge, decodeOpaque, opaqueHash } from '../src/auth/login/crypto.js'
import {
  validatePasskeyConfiguration,
  configurationFingerprint,
  configuredLoginClient
} from '../src/auth/login/configuration.js'
import { createLoginHttpApp } from '../src/auth/login/http.js'

const opaque = () => randomBytes(32).toString('base64url')

test('passkey-only creation and strict app exchange proof inputs', () => {
  const input = {
    provider: 'passkey',
    clientId: 'desktop',
    codeChallenge: opaque(),
    codeChallengeMethod: 'S256'
  }
  assert.deepEqual(parseCreation(input), input)
  for (const provider of ['google', 'discord', null, {}]) {
    assert.throws(() => parseCreation({ ...input, provider }))
  }
  for (const codeChallenge of ['A'.repeat(42), 'A'.repeat(42) + 'B', opaque() + '=', null]) {
    assert.throws(() => parseCreation({ ...input, codeChallenge }))
  }
  assert.throws(() => parseCreation({ ...input, redirectUri: 'https://attacker.invalid' }))
  const code = opaque(),
    verifier = opaque()
  assert.equal(decodeOpaque(code).length, 32)
  assert.equal(opaqueHash(code).length, 32)
  assert.notEqual(challenge(verifier), opaqueHash(verifier).toString('base64url'))
  assert.throws(() =>
    parseExchange({ requestId: 'bad', clientId: 'desktop', code, codeVerifier: verifier })
  )
})

test('RP origin and fixed app return configuration reject trust-boundary changes', () => {
  const config = {
    apiOrigin: 'https://auth.example.test',
    rpId: 'auth.example.test',
    rpName: 'DFRAGON',
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
    { returnUrl: 'https://attacker.invalid' },
    { returnUrl: 'other://auth/callback' },
    { returnUrl: 'ldb.dev://auth/callback' },
    { returnUrl: 'dfragon://auth/callback?code=preselected' },
    { rpName: '' }
  ]) {
    assert.throws(() => validatePasskeyConfiguration({ ...config, ...change }))
  }
})

test('legacy production callback remains fixed when OCR login is enabled', () => {
  const base = {
    apiOrigin: 'https://auth.example.test',
    rpId: 'auth.example.test',
    rpName: 'LDB',
    returnUrl: 'ldb://auth/callback'
  }
  assert.deepEqual(validatePasskeyConfiguration(base), base)
  const config = validatePasskeyConfiguration({
    ...base,
    ocrReturnUrl: 'https://ocr.example.test/auth/callback'
  })
  assert.equal(config.returnUrl, base.returnUrl)
  const desktop = configurationFingerprint(base)
  assert.equal(configurationFingerprint(config), desktop)
  assert.equal(configuredLoginClient(config, desktop), 'desktop')
  assert.notEqual(configurationFingerprint(config, 'ocr'), desktop)
  for (const returnUrl of [
    'ldb://attacker/callback',
    'ldb://auth/elsewhere',
    'ldb://auth:123/callback',
    'ldb://user@auth/callback',
    'ldb://auth/callback?code=preselected',
    'ldb://auth/callback#fragment'
  ]) {
    assert.throws(() => validatePasskeyConfiguration({ ...config, returnUrl }))
  }
})

test('an IP already rate-limited cannot consume the global authentication allowance behind the trusted proxy', async () => {
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
    { apiKey: 'synthetic', trustedProxyHops: 1 }
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

test('OCR callback is fixed HTTPS configuration and cannot change desktop request bindings', () => {
  const base = {
    apiOrigin: 'https://auth.example.test',
    rpId: 'auth.example.test',
    rpName: 'DFRAGON',
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
