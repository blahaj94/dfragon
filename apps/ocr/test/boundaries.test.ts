import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCreatedLogin, parseLoginTokens } from '../src/auth-responses.js'
import { httpFailure, OcrError } from '../src/errors.js'

test('malformed authentication responses are upstream failures', () => {
  for (const response of [
    null,
    [],
    {},
    { accessToken: 'token', accessTokenExpiresAt: 'invalid' }
  ]) {
    assert.throws(() => parseLoginTokens(response), { code: 'AUTH_UNAVAILABLE' })
  }
  assert.throws(
    () =>
      parseCreatedLogin({
        requestId: 'request',
        browserUrl: 'invalid',
        expiresAt: '2026-09-25T00:00:00.000Z'
      }),
    { code: 'AUTH_UNAVAILABLE' }
  )
})

test('HTTP boundary preserves classified errors and distinguishes invalid JSON from internal bugs', () => {
  const classified = new OcrError('LABEL_SPLIT_CHANGE')

  assert.equal(httpFailure(classified), classified)
  assert.equal(httpFailure({ type: 'entity.parse.failed' }).code, 'INVALID_INPUT')
  assert.equal(httpFailure({ type: 'entity.too.large' }).code, 'UPLOAD_TOO_LARGE')
  assert.equal(httpFailure(new SyntaxError('internal detail')).code, 'UNAVAILABLE')
})

test('in-flight logins reserve capacity and failures release their reservations', async () => {
  const { OcrAuth } = await import('../src/auth.js')
  const { OCR_AUTH } = await import('../src/constants.js')
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let calls = 0
  let fail = true
  const upstream: typeof fetch = async () => {
    calls++
    await released
    return fail
      ? new Response(null, { status: 503 })
      : Response.json({
          requestId: 'synthetic',
          browserUrl: 'https://auth.example.test/auth/login/authorize',
          expiresAt: new Date(Date.now() + OCR_AUTH.pendingLifetimeMs).toISOString()
        })
  }
  const auth = new OcrAuth(
    {
      origin: 'https://ocr.example.test',
      authOrigin: 'https://auth.example.test',
      ownerId: 'synthetic-owner'
    },
    upstream
  )
  const request = { cookies: {} } as import('express').Request
  const response = { cookie() {}, json() {} } as unknown as import('express').Response
  const requests = Array.from({ length: OCR_AUTH.maximumPendingLogins }, () =>
    auth.begin(request, response)
  )

  await assert.rejects(auth.begin(request, response), { code: 'LOGIN_LIMIT' })
  assert.equal(calls, OCR_AUTH.maximumPendingLogins)
  release()
  const results = await Promise.allSettled(requests)
  assert(results.every((result) => result.status === 'rejected'))

  fail = false
  await auth.begin(request, response)
  assert.equal(calls, OCR_AUTH.maximumPendingLogins + 1)
  await auth.close()
})
