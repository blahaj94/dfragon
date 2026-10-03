import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCreatedLogin, parseLoginTokens } from '../src/auth-responses.js'
import { httpFailure, OcrError } from '../src/errors.js'

test('잘못된 인증 응답을 인증 서버 오류로 분류한다', () => {
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

test('HTTP 경계는 분류된 오류를 보존하고 잘못된 JSON과 내부 결함을 구분한다', () => {
  const classified = new OcrError('LABEL_SPLIT_CHANGE')

  assert.equal(httpFailure(classified), classified)
  assert.equal(httpFailure({ type: 'entity.parse.failed' }).code, 'INVALID_INPUT')
  assert.equal(httpFailure({ type: 'entity.too.large' }).code, 'UPLOAD_TOO_LARGE')
  assert.equal(httpFailure(new SyntaxError('internal detail')).code, 'UNAVAILABLE')
})

test('진행 중 로그인도 전체 대기 용량을 예약하고 실패하면 예약을 반환한다', async (t) => {
  const { OcrAuth } = await import('../src/auth.js')
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let calls = 0
  let fail = true
  const upstream: typeof fetch = async () => {
    calls++
    await released
    if (fail) {
      return new Response(null, { status: 503 })
    }

    return Response.json({
      requestId: 'synthetic',
      browserUrl: 'https://auth.example.test/auth/login/authorize',
      expiresAt: new Date(Date.now() + 600_000).toISOString()
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
  let now = Date.now()
  t.mock.method(Date, 'now', () => now)
  const response = { cookie() {}, json() {} } as unknown as import('express').Response
  const request = (index: number) => {
    const ip = `192.0.2.${index + 1}`

    return { ip, cookies: {} } as import('express').Request
  }
  const requests = Array.from({ length: 100 }, (_, index) => {
    if (index === 60) {
      now += 60_000
    }

    return auth.begin(request(index), response)
  })

  await assert.rejects(auth.begin(request(101), response), { code: 'LOGIN_LIMIT' })
  assert.equal(calls, 100)
  release()
  const results = await Promise.allSettled(requests)
  assert(results.every((result) => result.status === 'rejected'))

  fail = false
  await auth.begin(request(101), response)
  assert.equal(calls, 100 + 1)
  await auth.close()
})
