import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { Writable } from 'node:stream'
import test from 'node:test'
import { type AccessLogSink, createStreamAccessLogSink } from '../src/access-log.js'
import { OcrAuth } from '../src/auth.js'
import { OCR_UPLOAD } from '../src/constants.js'
import { createOcrApp } from '../src/server.js'
import { OcrStore } from '../src/store.js'
import { syntheticUpload } from './fixtures.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const ISO_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// 로그에 나오면 안 되는 요청 값이다. 모두 합성 값이며 실제 credential이 아니다.
const secrets = {
  uploadToken: 'fake-synthetic-upload-token-7f3a-'.repeat(2),
  cookie: 'fake-cookie-value-91bd',
  code: randomBytes(32).toString('base64url'),
  query: 'fake-query-secret-4c2e',
  label: '비밀닉네임',
  pathValue: 'fake-path-sample-8d1f',
  errorDetail: 'fake-internal-detail-0b6c',
  clientCorrelationId: 'client-chosen-id-5e9a'
}
const sensitiveHeaders = {
  Cookie: `__Host-ocr-login=${secrets.cookie}; __Host-ocr-session=${secrets.cookie}`,
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

test('OCR 접근 로그는 allowlist field만 남기고 업로드 토큰, Cookie, code, 정답, 경로 값은 남기지 않는다', {
  timeout: 5000
}, async (t) => {
  const config = {
    origin: 'https://ocr.example.test',
    authOrigin: 'https://auth.example.test',
    ownerId: randomUUID(),
    syntheticUploadTokenSha256: createHash('sha256').update(secrets.uploadToken).digest('hex')
  }
  const store = new OcrStore(':memory:', 1024 * 1024)
  // 저장 단계의 예상하지 못한 오류가 원문 없이 정제 500으로 남는지 확인한다.
  store.add = () => {
    throw new Error(secrets.errorDetail)
  }
  const unusedAuthRequest: typeof fetch = async () => {
    throw new Error('access log requests must not call the auth server')
  }
  const logs = collectAccessLogs()
  const runtime = await createOcrApp(
    config,
    store,
    new OcrAuth(config, unusedAuthRequest),
    undefined,
    logs.sink
  )
  t.after(async () => {
    await runtime.close()
    store.close()
  })
  await runtime.app.listen(0, '127.0.0.1')
  const origin = await runtime.app.getUrl()
  const cases = [
    {
      name: '합성 업로드의 저장 오류',
      path: '/api/synthetic-samples',
      init: {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secrets.uploadToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(syntheticUpload(randomUUID(), secrets.label))
      },
      expected: {
        service: 'ocr',
        method: 'POST',
        route: '/api/synthetic-samples',
        status: 500,
        code: 'UNAVAILABLE'
      }
    },
    {
      name: '로그인 callback의 code 거절',
      path: `/auth/callback?code=${secrets.code}`,
      init: {},
      expected: {
        service: 'ocr',
        method: 'GET',
        route: '/auth/callback',
        status: 400,
        code: 'LOGIN_INVALID'
      }
    },
    {
      name: 'route 매칭 전 인증 거절',
      path: `/api/samples/${secrets.pathValue}/image`,
      init: {},
      expected: {
        service: 'ocr',
        method: 'GET',
        route: '<unmatched>',
        status: 401,
        code: 'LOGIN_REQUIRED'
      }
    },
    {
      name: '매칭되지 않은 경로',
      path: `/missing/${secrets.pathValue}?token=${secrets.query}`,
      init: {},
      expected: {
        service: 'ocr',
        method: 'GET',
        route: '<unmatched>',
        status: 404,
        code: 'NOT_FOUND'
      }
    },
    {
      name: '정상 응답',
      path: '/health',
      init: {},
      expected: { service: 'ocr', method: 'GET', route: '/health', status: 200 }
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
  for (const [index, { name, expected }] of cases.entries()) {
    // 응답 header의 ID로 같은 요청의 로그 줄을 찾으며 클라이언트가 보낸 값은 쓰지 않는다.
    const correlationId = correlationIds[index]!
    assert.match(correlationId, UUID_PATTERN, name)
    assert.deepEqual(entries.get(correlationId), expected, name)
  }
  assert.equal(new Set(correlationIds).size, cases.length)
})

test('접근 로그 sink가 예외를 던져도 업로드 slot을 풀고 다음 업로드를 처리한다', {
  timeout: 5000
}, async (t) => {
  const config = {
    origin: 'https://ocr.example.test',
    authOrigin: 'https://auth.example.test',
    ownerId: randomUUID(),
    syntheticUploadTokenSha256: createHash('sha256').update(secrets.uploadToken).digest('hex')
  }
  const store = new OcrStore(':memory:', 1024 * 1024)
  const unusedAuthRequest: typeof fetch = async () => {
    throw new Error('access log requests must not call the auth server')
  }
  const logs = collectAccessLogs()
  const throwingSink: AccessLogSink = (line) => {
    logs.sink(line)
    throw new Error(secrets.errorDetail)
  }
  const runtime = await createOcrApp(
    config,
    store,
    new OcrAuth(config, unusedAuthRequest),
    undefined,
    throwingSink
  )
  t.after(async () => {
    await runtime.close()
    store.close()
  })
  await runtime.app.listen(0, '127.0.0.1')
  const origin = await runtime.app.getUrl()
  // 업로드 slot은 접근 로그보다 뒤에 등록한 close listener가 푼다. 그 listener가 건너뛰어지면
  // 동시 업로드 한도를 넘는 마지막 순차 업로드가 UPLOAD_BUSY로 거절된다.
  const uploadCount = OCR_UPLOAD.maximumConcurrent + 1
  for (let count = 1; count <= uploadCount; count += 1) {
    const response = await fetch(`${origin}/api/synthetic-samples`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secrets.uploadToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(syntheticUpload(randomUUID()))
    })
    assert.equal(response.status, 201)
    await response.arrayBuffer()
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
  sink('{"service":"ocr"}')
  // 오류 listener가 없으면 error event가 uncaught exception이 되어 close 전에 test가 실패한다.
  await closed

  assert.equal(closedPipe.destroyed, true)
})
