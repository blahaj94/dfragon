import assert from 'node:assert/strict'
import { Writable } from 'node:stream'
import test from 'node:test'
import { type AccessLogSink, createStreamAccessLogSink } from '../src/access-log.js'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createNeopleCharacterDetailsForTest } from '../src/characters/details/neople.js'
import { createApiHttpApp } from '../src/http.js'

const unusedProvider = async (): Promise<never> => {
  throw new Error('access log test must not call this provider')
}
const unusedCatalog = createCatalogService(unusedProvider)
const unusedDetails = { fetchDetails: unusedProvider, catalog: unusedCatalog }

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

// Neople 상세 경로 suffix별 합성 섹션 본문이다.
const sectionFields: Record<string, Record<string, unknown>> = {
  '': { jobId: 'job' },
  '/status': { status: [], buff: [] },
  '/equip/equipment': { equipment: [{ itemId: 'fixture-item' }], setItemInfo: [] },
  '/equip/avatar': { avatar: [] },
  '/equip/creature': { creature: null },
  '/equip/oath': { oath: null },
  '/equip/mist-assimilation': { mistAssimilation: null },
  '/skill/style': { skill: { style: { active: [] } } },
  '/skill/buff/equip/equipment': { skill: { buff: null } },
  '/skill/buff/equip/avatar': { skill: { buff: null } },
  '/skill/buff/equip/creature': { skill: { buff: null } }
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
  const app = await createApiHttpApp({
    search: { searchCharacters: failWithDetail },
    details: { fetchDetails: failWithDetail, catalog: unusedCatalog },
    todayGrade: { fetchShopGrade: unusedProvider },
    writeAccessLog: logs.sink
  })
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
    const correlationId = correlationIds[index]!
    assert.match(correlationId, UUID_PATTERN, name)
    const { errorChain, ...fields } = entries.get(correlationId) ?? {}
    assert.equal(Array.isArray(errorChain), expected.status >= 500, name)
    assert.deepEqual(fields, expected, name)
  }
  assert.equal(new Set(correlationIds).size, cases.length)
})

test('5xx 응답에는 오류 class 이름, code와 message를 뺀 stack frame만 담은 오류 chain을 남긴다', {
  timeout: 5000
}, async (t) => {
  const databaseFailure = Object.assign(
    new Error(`${secrets.errorDetail}\n    at forged (${secrets.query})`),
    { code: '57P01', detail: secrets.characterName }
  )
  const logs = collectAccessLogs()
  const app = await createApiHttpApp({
    search: {
      searchCharacters: async (): Promise<never> => {
        throw databaseFailure
      }
    },
    details: {
      fetchDetails: async (): Promise<never> => {
        throw secrets.token
      },
      catalog: unusedCatalog
    },
    todayGrade: { fetchShopGrade: unusedProvider },
    writeAccessLog: logs.sink
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  const searchName = encodeURIComponent(secrets.characterName)
  for (const path of [
    `/characters?characterName=${searchName}&serverId=cain`,
    `/characters/cain/${secrets.pathValue}`
  ]) {
    const response = await fetch(origin + path, { headers: sensitiveHeaders })
    assert.equal(response.status, 500)
    await response.arrayBuffer()
  }
  await logs.waitFor(2)

  const output = logs.lines.join('\n')
  for (const value of Object.values(secrets)) {
    assert.equal(output.includes(value), false, value)
  }
  const [search, detail] = logs.lines.map((line) => {
    const { errorChain } = readEntry(line).fields

    return errorChain as Array<{ name: string; code?: string; frames?: string[] }>
  })
  assert.deepEqual(
    search!.map(({ name, code }) => ({ name, code })),
    [
      { name: 'NeopleSearchFailure', code: undefined },
      { name: 'Error', code: '57P01' }
    ]
  )
  assert.match(search![1]!.frames![0]!, /access-log\.test\.js:\d+:\d+\)?$/)
  assert.equal(output.includes('forged'), false)
  assert.deepEqual(
    detail!.map(({ name }) => name),
    ['CharacterDetailFailure', '<non-error>']
  )
  assert.equal(detail![1]!.frames, undefined)
})

test('상세의 Neople 실패는 상세 오류와 원래 원인만 chain에 남기고 공급자 원문은 남기지 않는다', {
  timeout: 5000
}, async (t) => {
  const responses = [
    () =>
      Response.json({ error: { code: 'API901', message: secrets.errorDetail } }, { status: 503 }),
    () => new Response(`not json ${secrets.errorDetail}`, { status: 503 })
  ]
  const logs = collectAccessLogs()
  const app = await createApiHttpApp({
    search: { searchCharacters: async () => ({ rows: [] }) },
    details: {
      fetchDetails: createNeopleCharacterDetailsForTest('fake-key', {
        fetch: async () => responses.shift()!()
      }),
      catalog: unusedCatalog
    },
    todayGrade: { fetchShopGrade: unusedProvider },
    writeAccessLog: logs.sink
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  for (const [count, status] of [
    [1, 502],
    [2, 503]
  ] as const) {
    const response = await fetch(`${origin}/characters/cain/fixture-character`)
    assert.equal(response.status, status)
    await response.arrayBuffer()
    await logs.waitFor(count)
  }

  assert.equal(logs.lines.join('\n').includes(secrets.errorDetail), false)
  const [knownCode, malformed] = logs.lines.map((line) => {
    const chain = readEntry(line).fields.errorChain as Array<{ name: string }>

    return chain.map(({ name }) => name)
  })
  assert.deepEqual(knownCode, ['CharacterDetailFailure'])
  assert.deepEqual(malformed, ['CharacterDetailFailure', 'SyntaxError'])
})

test('상세 요청 로그에는 Neople 단계별 대기 시간만 붙이고, 실패한 요청은 끝난 단계까지만 남긴다', {
  timeout: 5000
}, async (t) => {
  const failingCharacterId = `${secrets.pathValue}-failing`
  const detailPath = /^\/df\/servers\/siroco\/characters\/([^/]+)(.*)$/
  const catalogRequests: string[][] = []
  const logs = collectAccessLogs()
  const app = await createApiHttpApp({
    search: { searchCharacters: unusedProvider },
    details: {
      fetchDetails: createNeopleCharacterDetailsForTest('fake-key', {
        fetch: async (request) => {
          const [, characterId, suffix = ''] = detailPath.exec(new URL(request.url).pathname) ?? []
          if (characterId === failingCharacterId && suffix !== '') {
            return Response.json({ error: { code: 'API901', message: secrets.errorDetail } })
          }

          return Response.json({
            serverId: 'siroco',
            characterId,
            characterName: secrets.characterName,
            ...sectionFields[suffix]
          })
        }
      }),
      catalog: createCatalogService(async (itemIds) => {
        catalogRequests.push(itemIds)

        return new Map()
      })
    },
    todayGrade: { fetchShopGrade: unusedProvider },
    writeAccessLog: logs.sink
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  for (const [count, characterId, status] of [
    [1, secrets.pathValue, 200],
    [2, failingCharacterId, 502]
  ] as const) {
    const response = await fetch(`${origin}/characters/siroco/${characterId}`)
    assert.equal(response.status, status)
    await response.arrayBuffer()
    await logs.waitFor(count)
  }

  assert.deepEqual(catalogRequests, [['fixture-item']])
  const output = logs.lines.join('\n')
  for (const value of [secrets.pathValue, secrets.characterName, secrets.errorDetail]) {
    assert.equal(output.includes(value), false, value)
  }
  const [succeeded, failed] = logs.lines.map((line) => {
    const { neopleMs, neopleShared } = readEntry(line).fields

    return { stages: neopleMs as Record<string, number>, neopleShared }
  })
  assert.deepEqual(Object.keys(succeeded!.stages).sort(), ['basic', 'catalog', 'sections'])
  assert.deepEqual(Object.keys(failed!.stages), ['basic'])
  for (const durationMs of [...Object.values(succeeded!.stages), failed!.stages.basic]) {
    assert(Number.isInteger(durationMs) && durationMs! >= 0)
  }
  assert.equal(succeeded!.neopleShared, undefined)
  assert.equal(failed!.neopleShared, undefined)
})

test('저장한 응답을 다시 보낸 상세 요청 로그는 단계 시간 없이 responseCached로 표시하고 강제 갱신은 refresh route로 다시 받은 단계를 남기며 query가 붙은 강제 갱신은 거절한다', {
  timeout: 5000
}, async (t) => {
  const basicRequests: string[] = []
  const logs = collectAccessLogs()
  const app = await createApiHttpApp({
    search: { searchCharacters: unusedProvider },
    details: {
      fetchDetails: createNeopleCharacterDetailsForTest('fake-key', {
        fetch: async (request) => {
          const suffix = new URL(request.url).pathname.replace(
            '/df/servers/siroco/characters/fixture-character',
            ''
          )
          if (suffix === '') {
            basicRequests.push(request.method)
          }

          return Response.json({
            serverId: 'siroco',
            characterId: 'fixture-character',
            characterName: `조회 ${basicRequests.length}`,
            ...sectionFields[suffix]
          })
        }
      }),
      catalog: createCatalogService(
        async (itemIds) => new Map(itemIds.map((itemId) => [itemId, { itemId }]))
      )
    },
    todayGrade: { fetchShopGrade: unusedProvider },
    writeAccessLog: logs.sink
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const detailUrl = `${await app.getUrl()}/characters/siroco/fixture-character`
  const requests = [
    { method: 'GET', url: detailUrl, status: 200, characterName: '조회 1' },
    { method: 'GET', url: detailUrl, status: 200, characterName: '조회 1' },
    { method: 'POST', url: `${detailUrl}/refresh`, status: 200, characterName: '조회 2' },
    { method: 'GET', url: detailUrl, status: 200, characterName: '조회 2' },
    { method: 'POST', url: `${detailUrl}/refresh?force=1`, status: 400 }
  ]
  for (const [index, expected] of requests.entries()) {
    const response = await fetch(expected.url, { method: expected.method })
    assert.equal(response.status, expected.status, `${index}`)
    const body = (await response.json()) as {
      character?: { characterName: string }
      error?: { code: string }
    }
    if (expected.characterName === undefined) {
      assert.equal(body.error?.code, 'INVALID_CHARACTER_QUERY')
    } else {
      assert.equal(body.character?.characterName, expected.characterName, `${index}`)
    }
    await logs.waitFor(index + 1)
  }

  assert.equal(basicRequests.length, 2)
  const entries = logs.lines.map((line) => {
    const { route, neopleMs, responseCached } = readEntry(line).fields

    return { route, stages: Object.keys(neopleMs ?? {}).sort(), responseCached }
  })
  const detailRoute = '/characters/:serverId/:characterId'
  const refreshRoute = `${detailRoute}/refresh`
  const built = ['basic', 'catalog', 'sections']
  assert.deepEqual(entries, [
    { route: detailRoute, stages: built, responseCached: undefined },
    { route: detailRoute, stages: [], responseCached: true },
    { route: refreshRoute, stages: built, responseCached: undefined },
    { route: detailRoute, stages: [], responseCached: true },
    { route: refreshRoute, stages: [], responseCached: undefined }
  ])
})

test('Stack을 만든 뒤 message가 바뀌면 frame을 생략하고, 원래 오류를 정제하다 예외가 나면 원인을 생략한다', {
  timeout: 5000
}, async (t) => {
  const changedMessage = new Error('stack을 만들 때의 message')
  assert.ok(changedMessage.stack)
  changedMessage.message = secrets.errorDetail
  const unreadableName = Object.defineProperty(new Error('getter'), 'name', {
    get(): never {
      throw new Error(secrets.errorDetail)
    }
  })
  const thrown = [changedMessage, unreadableName]
  const logs = collectAccessLogs()
  const app = await createApiHttpApp({
    search: {
      searchCharacters: async (): Promise<never> => {
        throw thrown.shift()
      }
    },
    details: unusedDetails,
    todayGrade: { fetchShopGrade: unusedProvider },
    writeAccessLog: logs.sink
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  const searchName = encodeURIComponent(secrets.characterName)
  for (let count = 1; count <= 2; count += 1) {
    const response = await fetch(`${origin}/characters?characterName=${searchName}&serverId=cain`)
    assert.equal(response.status, 500)
    await response.arrayBuffer()
    await logs.waitFor(count)
  }

  assert.equal(logs.lines.join('\n').includes(secrets.errorDetail), false)
  const [changed, unreadable] = logs.lines.map((line) => readEntry(line).fields)
  const changedChain = changed!.errorChain as Array<{ name: string; frames?: string[] }>
  assert.deepEqual(changedChain[1], { name: 'Error' })
  const unreadableChain = unreadable!.errorChain as Array<{ name: string }>
  assert.deepEqual(
    unreadableChain.map(({ name }) => name),
    ['NeopleSearchFailure']
  )
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
  const app = await createApiHttpApp({
    search: {
      searchCharacters: async (): Promise<never> => {
        markEntered()
        await gate
        throw new Error(secrets.errorDetail)
      }
    },
    todayGrade: { fetchShopGrade: unusedProvider },
    details: unusedDetails,
    writeAccessLog: logs.sink
  })
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
  const app = await createApiHttpApp({
    search: {
      searchCharacters: async (): Promise<never> => {
        throw new Error(secrets.errorDetail)
      }
    },
    details: unusedDetails,
    todayGrade: { fetchShopGrade: unusedProvider },
    writeAccessLog: throwingSink
  })
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
