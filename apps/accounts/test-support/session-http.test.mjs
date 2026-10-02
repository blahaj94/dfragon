import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { request } from 'node:http'
import { after, before, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { createLoginHttpApp } from '../dist/auth/login/http.js'
import { REFRESH_ERRORS, RefreshFailure } from '../dist/auth/refresh/errors.js'
import { LOGOUT_ERRORS, LogoutFailure } from '../dist/auth/logout/errors.js'
import { opaque } from './login-fixtures.mjs'

const cases = {
  success: 'refresh·logout은 refreshToken만 전달하고 no-store 성공 응답을 반환한다',
  transport: 'session route는 media·크기·UTF-8·JSON·필드 검사를 service 호출 전에 적용한다',
  bytes: 'session route의 JSON parser는 16,384 UTF-8 byte까지만 허용한다',
  refreshErrors: 'refresh 오류는 독립적인 공개 status·code·message 계약으로 정제한다',
  logoutErrors: 'logout의 DB·알 수 없는 실패는 204 대신 정제 오류를 반환한다',
  bearer: 'session route는 Authorization·query token으로 JSON refreshToken을 대체하지 않는다',
  login: 'session route 추가 후 로그인 GET과 HEAD의 동작을 유지한다'
}

let app
let base
let loginCalls = 0
const sessionCalls = { refresh: [], logout: [] }
let refreshFailure
let logoutFailure

const loginService = {
  create: async () => {
    loginCalls++
    const requestId = randomUUID()

    return {
      requestId,
      browserUrl: 'https://api.test.invalid/auth/login/authorize?ticket=test',
      expiresAt: '2026-09-06T00:00:00.000Z'
    }
  },
  exchange: async () => {
    loginCalls++

    return { tokenType: 'Bearer', accessToken: 'login-access', refreshToken: 'login-refresh' }
  },
  authorize: async () => {
    loginCalls++
    const requestId = randomUUID()

    return {
      requestId,
      purpose: 'login',
      cookie: '__Host-test=x; Secure; HttpOnly; SameSite=Lax; Path=/'
    }
  },
  callback: async () => {
    loginCalls++

    return {
      returnUrl: 'dfragon-test://login/complete?code=exchange-only',
      cookie: '__Host-test=; Max-Age=0; Secure; HttpOnly; SameSite=Lax; Path=/'
    }
  }
}

const sessionService = {
  refresh: async (rawToken) => {
    sessionCalls.refresh.push(rawToken)
    const hasRefreshFailure = refreshFailure != null
    if (hasRefreshFailure) {
      throw refreshFailure
    }

    return {
      tokenType: 'Bearer',
      accessToken: 'session-access',
      accessTokenExpiresAt: '2026-09-06T00:15:00.000Z',
      refreshToken: 'session-refresh',
      sessionExpiresAt: '2026-10-06T00:00:00.000Z'
    }
  },
  logout: async (rawToken) => {
    sessionCalls.logout.push(rawToken)
    const hasLogoutFailure = logoutFailure != null
    if (hasLogoutFailure) {
      throw logoutFailure
    }
  }
}

before(async () => {
  app = await createLoginHttpApp(loginService, sessionService)
  await app.listen(0, '127.0.0.1')
  base = await app.getUrl()
})

after(async () => {
  await app?.close()
})

function post(path, chunks, headers = {}) {
  return new Promise((resolve, reject) => {
    const httpRequest = request(
      `${base}${path}`,
      { method: 'POST', headers: { 'content-type': 'application/json', ...headers } },
      (response) => {
        const body = []
        response.on('data', (part) => body.push(part))
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(body).toString('utf8')
          })
        })
      }
    )
    httpRequest.on('error', reject)
    for (const chunk of chunks) {
      httpRequest.write(chunk)
    }
    httpRequest.end()
  })
}

test(cases.success, async () => {
  const refreshToken = opaque()
  const refreshed = await post('/auth/refresh', [JSON.stringify({ refreshToken })])
  assert.equal(refreshed.status, 200)
  assert.equal(refreshed.headers['cache-control'], 'no-store')
  assert.deepEqual(JSON.parse(refreshed.body), {
    tokenType: 'Bearer',
    accessToken: 'session-access',
    accessTokenExpiresAt: '2026-09-06T00:15:00.000Z',
    refreshToken: 'session-refresh',
    sessionExpiresAt: '2026-10-06T00:00:00.000Z'
  })
  assert.deepEqual(sessionCalls.refresh, [refreshToken])

  const loggedOut = await post('/auth/logout', [JSON.stringify({ refreshToken })])
  assert.equal(loggedOut.status, 204)
  assert.equal(loggedOut.headers['cache-control'], 'no-store')
  assert.equal(loggedOut.body, '')
  assert.deepEqual(sessionCalls.logout, [refreshToken])
})

test(cases.transport, async () => {
  const baseline = {
    login: loginCalls,
    refresh: sessionCalls.refresh.length,
    logout: sessionCalls.logout.length
  }
  for (const path of ['/auth/refresh', '/auth/logout']) {
    for (const [chunks, headers, status, code] of [
      [[Buffer.alloc(17_000)], { 'content-type': 'text/plain' }, 415, 'UNSUPPORTED_MEDIA_TYPE'],
      [[Buffer.alloc(17_000)], { 'content-encoding': 'gzip' }, 415, 'UNSUPPORTED_MEDIA_TYPE'],
      [[Buffer.alloc(8_000), Buffer.alloc(8_385)], {}, 413, 'REQUEST_TOO_LARGE'],
      [[Buffer.alloc(16_384, 'x')], {}, 400, 'INVALID_AUTH_REQUEST'],
      [[Buffer.from([0xff])], {}, 400, 'INVALID_AUTH_REQUEST'],
      [[], {}, 400, 'INVALID_AUTH_REQUEST'],
      [['{'], {}, 400, 'INVALID_AUTH_REQUEST'],
      [['null'], {}, 400, 'INVALID_AUTH_REQUEST'],
      [['[]'], {}, 400, 'INVALID_AUTH_REQUEST'],
      [['{}'], {}, 400, 'INVALID_AUTH_REQUEST'],
      [
        [JSON.stringify({ refreshToken: opaque(), sessionId: randomUUID() })],
        {},
        400,
        'INVALID_AUTH_REQUEST'
      ],
      [[JSON.stringify({ refreshToken: 1 })], {}, 400, 'INVALID_AUTH_REQUEST']
    ]) {
      const response = await post(path, chunks, headers)
      assert.equal(response.status, status)
      assert.equal(response.headers['cache-control'], 'no-store')
      assert.equal(JSON.parse(response.body).error.code, code)
      const isTooLarge = status === 413
      if (isTooLarge) {
        assert.equal(response.headers.connection, 'close')
      }
    }
  }
  assert.deepEqual(
    {
      login: loginCalls,
      refresh: sessionCalls.refresh.length,
      logout: sessionCalls.logout.length
    },
    baseline
  )
})

test(cases.bytes, async () => {
  for (const path of ['/auth/refresh', '/auth/logout']) {
    const prefix = '{"refreshToken":"'
    const suffix = '"}'
    const atLimit = prefix + 'x'.repeat(16_384 - prefix.length - suffix.length) + suffix
    assert.equal(Buffer.byteLength(atLimit), 16_384)
    const accepted = await post(path, [atLimit.slice(0, 8_000), atLimit.slice(8_000)], {
      'content-type': 'application/json; charset="utf-8"',
      'content-encoding': 'identity'
    })
    const isLogoutPath = path.endsWith('logout')
    const expectedStatus = isLogoutPath ? 204 : 200
    assert.equal(accepted.status, expectedStatus)

    const rejected = await post(path, [atLimit, ' '])
    assert.equal(rejected.status, 413)
    assert.equal(JSON.parse(rejected.body).error.code, 'REQUEST_TOO_LARGE')
  }
})

test(cases.refreshErrors, async () => {
  try {
    for (const [definition, status, code, message] of [
      [REFRESH_ERRORS.INVALID_REQUEST, 400, 'INVALID_AUTH_REQUEST', '인증 요청을 확인해 주세요.'],
      [
        REFRESH_ERRORS.AUTHENTICATION_REQUIRED,
        401,
        'AUTHENTICATION_REQUIRED',
        '로그인이 필요합니다.'
      ],
      [REFRESH_ERRORS.INTERNAL, 500, 'AUTH_INTERNAL_ERROR', '인증 요청을 처리하지 못했습니다.'],
      [
        REFRESH_ERRORS.UNAVAILABLE,
        503,
        'AUTH_UNAVAILABLE',
        '현재 계정 기능을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      ]
    ]) {
      refreshFailure = new RefreshFailure(definition)
      const response = await post('/auth/refresh', [JSON.stringify({ refreshToken: opaque() })])
      assert.equal(response.status, status)
      assert.equal(response.headers['cache-control'], 'no-store')
      assert.deepEqual(JSON.parse(response.body), { error: { code, message } })
    }
    refreshFailure = new Error('raw credential identity SQL https://private.invalid')
    const internal = await post('/auth/refresh', [JSON.stringify({ refreshToken: opaque() })])
    assert.equal(internal.status, 500)
    assert.deepEqual(JSON.parse(internal.body), {
      error: {
        code: 'AUTH_INTERNAL_ERROR',
        message: '인증 요청을 처리하지 못했습니다.'
      }
    })
    assert.doesNotMatch(internal.body, /raw|credential|identity|SQL|private/)
  } finally {
    refreshFailure = undefined
  }
})

test(cases.logoutErrors, async () => {
  try {
    for (const [failure, status, code, message] of [
      [
        new LogoutFailure(LOGOUT_ERRORS.UNAVAILABLE),
        503,
        'AUTH_UNAVAILABLE',
        '현재 계정 기능을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      ],
      [
        new Error('raw credential identity SQL https://private.invalid'),
        500,
        'AUTH_INTERNAL_ERROR',
        '인증 요청을 처리하지 못했습니다.'
      ]
    ]) {
      logoutFailure = failure
      const response = await post('/auth/logout', [JSON.stringify({ refreshToken: opaque() })])
      assert.equal(response.status, status)
      assert.equal(response.headers['cache-control'], 'no-store')
      assert.deepEqual(JSON.parse(response.body), { error: { code, message } })
      assert.doesNotMatch(response.body, /raw|credential|identity|SQL|private/)
    }
  } finally {
    logoutFailure = undefined
  }
})

test(cases.bearer, async () => {
  const baseline = { refresh: sessionCalls.refresh.length, logout: sessionCalls.logout.length }
  for (const path of ['/auth/refresh', '/auth/logout']) {
    for (const body of [
      {},
      { accessToken: 'access-canary' },
      { refreshToken: opaque(), userId: randomUUID() },
      { refreshToken: opaque(), clientId: 'desktop' },
      { refreshToken: opaque(), sessionId: randomUUID() }
    ]) {
      const response = await post(
        `${path}?refreshToken=${opaque()}&accessToken=access-canary`,
        [JSON.stringify(body)],
        { authorization: 'Bearer access-canary' }
      )
      assert.equal(response.status, 400)
      assert.equal(response.headers['cache-control'], 'no-store')
      assert.deepEqual(JSON.parse(response.body), {
        error: { code: 'INVALID_AUTH_REQUEST', message: '인증 요청을 확인해 주세요.' }
      })
      assert.doesNotMatch(response.body, /access-canary|userId|sessionId|clientId/)
    }
  }
  assert.deepEqual(
    { refresh: sessionCalls.refresh.length, logout: sessionCalls.logout.length },
    baseline
  )
})

test(cases.login, async () => {
  const refreshBefore = sessionCalls.refresh.length
  const logoutBefore = sessionCalls.logout.length
  const head = await fetch(`${base}/auth/login/authorize?ticket=${opaque()}`, {
    method: 'HEAD',
    redirect: 'manual'
  })
  assert.equal(head.status, 400)
  assert.equal(head.headers.get('cache-control'), 'no-store')
  assert.equal(await head.text(), '')

  const get = await fetch(`${base}/auth/login/authorize?ticket=${opaque()}`, {
    redirect: 'manual'
  })
  assert.equal(get.status, 200)
  assert.equal(get.headers.get('cache-control'), 'no-store')
  assert.equal(sessionCalls.refresh.length, refreshBefore)
  assert.equal(sessionCalls.logout.length, logoutBefore)
})
