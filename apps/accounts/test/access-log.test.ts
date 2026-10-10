import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { Writable } from 'node:stream'
import test from 'node:test'
import { DataSource } from 'typeorm'
import { type AccessLogSink, createStreamAccessLogSink } from '../src/access-log.js'
import { createLoginHttpApp } from '../src/auth/login/http.js'
import { LOGIN_ERRORS } from '../src/constants/login.js'
import { LoginFailure } from '../src/errors/login.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const ISO_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// 로그에 나오면 안 되는 요청 값이다. 모두 합성 값이며 실제 credential이 아니다.
const secrets = {
  accessToken: 'fake-access-token-7f3a',
  refreshToken: 'fake-refresh-token-2a7c',
  cookie: 'fake-cookie-value-91bd',
  ticket: 'fake-launch-ticket-4c2e',
  code: randomBytes(32).toString('base64url'),
  verifier: randomBytes(32).toString('base64url'),
  loginRequestId: randomUUID(),
  nickname: '비밀닉네임',
  pathValue: 'fake-path-action-8d1f',
  errorDetail: 'fake-internal-detail-0b6c',
  clientCorrelationId: 'client-chosen-id-5e9a'
}
const sensitiveHeaders = {
  Authorization: `Bearer ${secrets.accessToken}`,
  Cookie: `__Host-dfragon-login-${secrets.loginRequestId}=${secrets.cookie}`,
  'X-Correlation-Id': secrets.clientCorrelationId,
  'X-Request-Id': secrets.clientCorrelationId
}

function collectAccessLogs() {
  const lines: string[] = []
  let notify: (() => void) | undefined
  const sink: AccessLogSink = (line) => {
    lines.push(line)
    notify?.()
  }
  // 응답을 받은 뒤 서버의 close event가 늦게 올 수 있어 줄 수로 완료를 기다린다.
  const waitFor = async (count: number): Promise<void> => {
    while (lines.length < count) {
      await new Promise<void>((resolve) => {
        notify = resolve
      })
    }
  }

  return { lines, sink, waitFor }
}

function readEntry(line: string) {
  const entry = JSON.parse(line) as Record<string, unknown>
  const { time, durationMs, correlationId, ...fields } = entry
  assert.equal(typeof time, 'string')
  assert.match(time as string, ISO_TIME_PATTERN)
  assert(Number.isInteger(durationMs))
  assert((durationMs as number) >= 0)
  assert.equal(typeof correlationId, 'string')
  assert.match(correlationId as string, UUID_PATTERN)

  return { correlationId: correlationId as string, fields }
}

test('인증 접근 로그는 allowlist field만 남기고 ticket, code, verifier, token, Cookie, nickname, 경로 값은 남기지 않는다', {
  timeout: 5000
}, async (t) => {
  const failWithDetail = async (): Promise<never> => {
    throw new Error(secrets.errorDetail)
  }
  const logs = collectAccessLogs()
  const app = await createLoginHttpApp(
    {
      create: failWithDetail,
      authorize: failWithDetail,
      manage: failWithDetail,
      browser: async (): Promise<never> => {
        throw new LoginFailure(LOGIN_ERRORS.PASSKEY)
      },
      exchange: async (): Promise<never> => {
        throw new LoginFailure(LOGIN_ERRORS.EXCHANGE_INVALID)
      }
    },
    { refresh: failWithDetail, logout: failWithDetail },
    {
      // 초기화하지 않은 DataSource라 JWT 확인 뒤 transaction이 실패해 정제 503이 된다.
      dataSource: new DataSource({ type: 'postgres' }),
      verifyAccessJwt: async () => ({
        userId: randomUUID(),
        sessionId: randomUUID(),
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 600,
        tokenId: randomUUID()
      })
    },
    { writeAccessLog: logs.sink }
  )
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  const json = { 'Content-Type': 'application/json' }
  const cases = [
    {
      name: '일회용 ticket 화면의 내부 오류',
      path: `/auth/login/authorize?ticket=${secrets.ticket}`,
      init: {},
      expected: {
        service: 'accounts',
        method: 'GET',
        route: '/auth/login/authorize',
        status: 500,
        code: 'AUTH_INTERNAL_ERROR'
      },
      // Filter가 받은 원래 오류가 chain의 시작이다.
      errorChain: [{ name: 'Error' }]
    },
    {
      name: '앱 교환의 code, verifier 거절',
      path: '/auth/exchange',
      init: {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          requestId: secrets.loginRequestId,
          clientId: 'desktop',
          code: secrets.code,
          codeVerifier: secrets.verifier
        })
      },
      expected: {
        service: 'accounts',
        method: 'POST',
        route: '/auth/exchange',
        status: 400,
        code: 'LOGIN_EXCHANGE_INVALID'
      }
    },
    {
      name: '패스키 action 경로 parameter',
      path: `/auth/passkeys/${secrets.pathValue}`,
      init: {
        method: 'POST',
        headers: { ...json, Origin: 'https://auth.example.test' },
        body: JSON.stringify({ challenge: secrets.code })
      },
      expected: {
        service: 'accounts',
        method: 'POST',
        route: '/auth/passkeys/:action',
        status: 400,
        code: 'PASSKEY_INVALID'
      }
    },
    {
      name: '닉네임 변경의 DB 장애',
      path: '/me/nickname',
      init: {
        method: 'PATCH',
        headers: json,
        body: JSON.stringify({ nickname: secrets.nickname })
      },
      expected: {
        service: 'accounts',
        method: 'PATCH',
        route: '/me/nickname',
        status: 503,
        code: 'AUTH_UNAVAILABLE'
      },
      // 정제 503으로 바꾼 지점과 DB 오류를 cause로 이어 남긴다.
      errorChain: [{ name: 'AccountFailure', code: 'AUTH_UNAVAILABLE' }, { name: 'TypeORMError' }]
    },
    {
      name: 'route 매칭 전 JSON parser 거절',
      path: '/auth/refresh',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: secrets.refreshToken
      },
      expected: {
        service: 'accounts',
        method: 'POST',
        route: '<unmatched>',
        status: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE'
      }
    },
    {
      name: '매칭되지 않은 경로',
      path: `/auth/${secrets.pathValue}?code=${secrets.code}&refreshToken=${secrets.refreshToken}`,
      init: {},
      expected: { service: 'accounts', method: 'GET', route: '<unmatched>', status: 404 }
    },
    {
      name: '정상 응답',
      path: '/version',
      init: {},
      expected: { service: 'accounts', method: 'GET', route: '/version', status: 200 }
    }
  ]
  const correlationIds: string[] = []
  for (const { path, init } of cases) {
    const caseHeaders = 'headers' in init ? init.headers : {}
    const headers = { ...sensitiveHeaders, ...caseHeaders }
    const response = await fetch(origin + path, { ...init, headers })
    await response.arrayBuffer()
    correlationIds.push(response.headers.get('x-correlation-id') ?? '')
  }
  await logs.waitFor(cases.length)

  assert.equal(logs.lines.length, cases.length)
  const output = logs.lines.join('\n')
  for (const value of Object.values(secrets)) {
    assert.equal(output.includes(value), false, value)
    assert.equal(output.includes(encodeURIComponent(value)), false, value)
  }
  const entries = new Map(
    logs.lines.map((line) => {
      const entry = readEntry(line)

      return [entry.correlationId, entry.fields]
    })
  )
  for (const [index, { name, expected, ...rest }] of cases.entries()) {
    // 응답 header의 ID로 같은 요청의 로그 줄을 찾으며 클라이언트가 보낸 값은 쓰지 않는다.
    const correlationId = correlationIds[index]!
    assert.match(correlationId, UUID_PATTERN, name)
    const { errorChain, ...fields } = entries.get(correlationId) ?? {}
    assert.deepEqual(fields, expected, name)
    // Frame 내용은 위치마다 달라 이름과 code만 비교한다. 4xx 이하 응답에는 chain이 없다.
    const chain = errorChain as Array<{ name: string; code?: string }> | undefined
    const summary = chain?.map(({ name: errorName, code }) =>
      code === undefined ? { name: errorName } : { name: errorName, code }
    )
    assert.deepEqual(summary, 'errorChain' in rest ? rest.errorChain : undefined, name)
  }
  assert.equal(new Set(correlationIds).size, cases.length)
})

test('접근 로그 sink가 예외를 던져도 process를 끝내지 않고 다음 요청을 처리한다', {
  timeout: 5000
}, async (t) => {
  const failWithDetail = async (): Promise<never> => {
    throw new Error(secrets.errorDetail)
  }
  const logs = collectAccessLogs()
  const throwingSink: AccessLogSink = (line) => {
    logs.sink(line)
    throw new Error(secrets.errorDetail)
  }
  const app = await createLoginHttpApp(
    {
      create: failWithDetail,
      authorize: failWithDetail,
      manage: failWithDetail,
      browser: failWithDetail,
      exchange: failWithDetail
    },
    undefined,
    undefined,
    { writeAccessLog: throwingSink }
  )
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  for (let count = 1; count <= 2; count += 1) {
    const response = await fetch(`${origin}/version`)
    assert.equal(response.status, 200)
    await response.arrayBuffer()
    // sink 예외가 close event 밖으로 나가면 test process의 uncaught exception으로 실패한다.
    await logs.waitFor(count)
  }
})

test('닫힌 pipe처럼 stream 쓰기가 실패해도 오류 event로 process를 끝내지 않는다', {
  timeout: 5000
}, async () => {
  const closedPipe = new Writable({
    write(_chunk, _encoding, callback) {
      // 읽는 쪽이 닫힌 pipe에 쓰면 Node는 EPIPE를 stream의 error event로 알린다.
      callback(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))
    }
  })
  // events.once는 error event에 reject하므로 close만 기다리는 listener를 직접 둔다.
  const closed = new Promise<void>((resolve) => {
    closedPipe.once('close', resolve)
  })
  const sink = createStreamAccessLogSink(closedPipe)
  sink('{"service":"accounts"}')
  // 오류 listener가 없으면 error event가 uncaught exception이 되어 close 전에 test가 실패한다.
  await closed

  assert.equal(closedPipe.destroyed, true)
})
