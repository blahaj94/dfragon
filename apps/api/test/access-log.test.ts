import assert from 'node:assert/strict'
import { Writable } from 'node:stream'
import test from 'node:test'
import { type AccessLogSink, createStreamAccessLogSink } from '../src/access-log.js'
import { createApiHttpApp } from '../src/http.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const ISO_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// 로그에 나오면 안 되는 요청 값이다. 모두 합성 값이며 실제 credential이 아니다.
const secrets = {
  token: 'fake-bearer-token-7f3a',
  cookie: 'fake-cookie-value-91bd',
  query: 'fake-query-secret-4c2e',
  characterName: '비밀검색어',
  nickname: '비밀닉네임',
  pathValue: 'fake-path-character-8d1f',
  errorDetail: 'fake-internal-detail-0b6c',
  clientCorrelationId: 'client-chosen-id-5e9a'
}
const sensitiveHeaders = {
  Authorization: `Bearer ${secrets.token}`,
  Cookie: `session=${secrets.cookie}`,
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

test('접근 로그는 요청마다 allowlist field 한 줄만 남기고 credential, query, body, 경로 값은 남기지 않는다', {
  timeout: 5000
}, async (t) => {
  const failWithDetail = async (): Promise<never> => {
    throw new Error(secrets.errorDetail)
  }
  const logs = collectAccessLogs()
  const app = await createApiHttpApp(
    { searchCharacters: failWithDetail },
    {
      store: { read: failWithDetail, beginFetch: failWithDetail, saveAndRead: failWithDetail },
      fetchDetails: failWithDetail
    },
    undefined,
    undefined,
    undefined,
    undefined,
    logs.sink
  )
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  const searchName = encodeURIComponent(secrets.characterName)
  const cases = [
    {
      name: '검색 내부 오류',
      path: `/characters?characterName=${searchName}&serverId=cain`,
      init: {},
      expected: {
        service: 'api',
        method: 'GET',
        route: '/characters',
        status: 500,
        code: 'INTERNAL_SERVER_ERROR'
      }
    },
    {
      name: '상세 경로 parameter와 내부 오류',
      path: `/characters/cain/${secrets.pathValue}`,
      init: {},
      expected: {
        service: 'api',
        method: 'GET',
        route: '/characters/:serverId/:characterId',
        status: 500,
        code: 'INTERNAL_SERVER_ERROR'
      }
    },
    {
      name: '정제 400 오류',
      path: `/characters/candidates?token=${secrets.query}`,
      init: {},
      expected: {
        service: 'api',
        method: 'GET',
        route: '/characters/candidates',
        status: 400,
        code: 'INVALID_SEARCH_QUERY'
      }
    },
    {
      name: '매칭되지 않은 경로',
      path: `/accounts/${secrets.pathValue}?access_token=${secrets.query}`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: secrets.nickname, refreshToken: secrets.token })
      },
      expected: { service: 'api', method: 'POST', route: '<unmatched>', status: 404 }
    },
    {
      name: '정상 응답',
      path: '/health',
      init: {},
      expected: { service: 'api', method: 'GET', route: '/health', status: 200 }
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

test('응답 header를 보내기 전에 연결이 끊기면 status 없이 aborted로 남긴다', {
  timeout: 5000
}, async (t) => {
  let markEntered!: () => void
  const entered = new Promise<void>((resolve) => {
    markEntered = resolve
  })
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const logs = collectAccessLogs()
  const app = await createApiHttpApp(
    {
      searchCharacters: async (): Promise<never> => {
        markEntered()
        await gate
        throw new Error(secrets.errorDetail)
      }
    },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    logs.sink
  )
  t.after(async () => {
    release()
    await app.close()
  })
  await app.listen(0, '127.0.0.1')
  const searchName = encodeURIComponent(secrets.characterName)
  const disconnect = new AbortController()
  const pending = fetch(`${await app.getUrl()}/characters?characterName=${searchName}`, {
    signal: disconnect.signal
  }).catch(() => undefined)
  await entered
  disconnect.abort()
  await pending
  await logs.waitFor(1)

  assert.deepEqual(readEntry(logs.lines[0]!).fields, {
    service: 'api',
    method: 'GET',
    route: '/characters',
    aborted: true
  })
})

test('접근 로그 sink가 예외를 던져도 process를 끝내지 않고 다음 요청을 처리한다', {
  timeout: 5000
}, async (t) => {
  const logs = collectAccessLogs()
  const throwingSink: AccessLogSink = (line) => {
    logs.sink(line)
    throw new Error(secrets.errorDetail)
  }
  const app = await createApiHttpApp(
    {
      searchCharacters: async (): Promise<never> => {
        throw new Error(secrets.errorDetail)
      }
    },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    throwingSink
  )
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  for (let count = 1; count <= 2; count += 1) {
    const response = await fetch(`${origin}/health`)
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
  sink('{"service":"api"}')
  // 오류 listener가 없으면 error event가 uncaught exception이 되어 close 전에 test가 실패한다.
  await closed

  assert.equal(closedPipe.destroyed, true)
})
