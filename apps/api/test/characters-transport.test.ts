import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import test from 'node:test'
import { createNeopleCharacterSearchForTest } from '../src/characters/neople-character-search.js'
import { NeopleSearchFailure } from '../src/errors/neople-search.js'

interface Loopback {
  origin: string
  server: Server
}

async function startLoopback(
  handler: (request: IncomingMessage, response: ServerResponse) => void
): Promise<Loopback> {
  const server = createServer(handler)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`

  return { origin, server }
}

async function closeLoopback(server: Server): Promise<void> {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      const hasError = error != null
      if (hasError) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

async function expectStatus(
  promise: Promise<unknown>,
  status: number
): Promise<NeopleSearchFailure> {
  try {
    await promise
  } catch (error) {
    const isSearchFailure = error instanceof NeopleSearchFailure
    assert(isSearchFailure)
    assert.equal(error.status, status)
    const bodies = new Map([
      [
        502,
        { error: { code: 'NEOPLE_API_ERROR', message: '캐릭터 검색 중 오류가 발생했습니다.' } }
      ],
      [
        503,
        {
          error: {
            code: 'NEOPLE_UNAVAILABLE',
            message: '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
          }
        }
      ],
      [
        504,
        {
          error: {
            code: 'NEOPLE_TIMEOUT',
            message: '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.'
          }
        }
      ]
    ])
    assert(bodies.has(status))
    assert.deepEqual(error.body, bodies.get(status))

    return error
  }
  assert.fail('검색 실패를 예상했습니다.')
}

test('native fetch는 고정 endpoint와 검색어를 encode하고 API key를 헤더로 한 번만 전달한다', async () => {
  const requests: IncomingMessage[] = []
  const loopback = await startLoopback((request, response) => {
    requests.push(request)
    response.setHeader('content-type', 'application/json')
    response.end(
      JSON.stringify({
        rows: [{ characterId: 'id', characterName: '가 나+&/?', serverId: 'cain', fame: 0 }]
      })
    )
  })

  try {
    const search = createNeopleCharacterSearchForTest('obvious-placeholder-key', {
      fetch,
      origin: loopback.origin
    })
    const result = await search({ characterName: '가 나+&/?', serverId: 'cain', limit: 200 })

    assert.deepEqual(result, {
      rows: [
        {
          characterId: 'id',
          characterName: '가 나+&/?',
          serverId: 'cain',
          serverName: '카인',
          fame: 0
        }
      ]
    })
    assert.equal(requests.length, 1)
    const request = requests[0]
    const hasRequestUrl = Boolean(request?.url)
    assert(hasRequestUrl)
    const validatedRequest = request as IncomingMessage
    const url = new URL(validatedRequest.url as string, loopback.origin)
    assert.equal(url.pathname, '/df/servers/cain/characters')
    assert.equal(url.searchParams.get('characterName'), '가 나+&/?')
    assert.equal(url.searchParams.get('limit'), '200')
    assert.equal(url.searchParams.get('wordType'), 'full')
    assert.equal(url.searchParams.size, 3)
    assert.equal(validatedRequest.method, 'GET')
    assert.equal(validatedRequest.headers.apikey, 'obvious-placeholder-key')
    assert.equal((validatedRequest.url as string).includes('obvious-placeholder-key'), false)
  } finally {
    await closeLoopback(loopback.server)
  }
})

test('native fetch는 redirect를 따라가거나 공급자 실패를 재시도하지 않는다', async () => {
  let requests = 0
  const loopback = await startLoopback((_request, response) => {
    requests += 1
    const isFirstRequest = requests === 1
    if (isFirstRequest) {
      response.writeHead(302, { location: '/followed' })
      response.end()

      return
    }
    response.end(JSON.stringify({ rows: [] }))
  })

  try {
    const search = createNeopleCharacterSearchForTest('obvious-placeholder-key', {
      fetch,
      origin: loopback.origin
    })
    const error = await expectStatus(
      search({ characterName: '리다이렉트', serverId: 'cain', limit: 10 }),
      502
    )
    assert.equal(error.body.error.code, 'NEOPLE_API_ERROR')
    assert.equal(requests, 1)
  } finally {
    await closeLoopback(loopback.server)
  }
})

test('loopback의 잘못된 JSON은 공급자 HTTP 503 fallback으로 정제한다', async () => {
  let requests = 0
  const loopback = await startLoopback((_request, response) => {
    requests += 1
    response.writeHead(503, { 'content-type': 'application/json' })
    response.end('not-json')
  })

  try {
    const search = createNeopleCharacterSearchForTest('obvious-placeholder-key', {
      fetch,
      origin: loopback.origin
    })
    const error = await expectStatus(
      search({ characterName: '점검중', serverId: 'all', limit: 1 }),
      503
    )
    assert.deepEqual(error.body, {
      error: {
        code: 'NEOPLE_UNAVAILABLE',
        message: '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      }
    })
    assert.equal(requests, 1)
  } finally {
    await closeLoopback(loopback.server)
  }
})

test('loopback API901 code는 HTTP 503보다 우선하여 502로 정제한다', async () => {
  let requests = 0
  const loopback = await startLoopback((_request, response) => {
    requests += 1
    response.writeHead(503, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: { code: 'API901', status: 503 } }))
  })

  try {
    const search = createNeopleCharacterSearchForTest('obvious-placeholder-key', {
      fetch,
      origin: loopback.origin
    })
    const error = await expectStatus(
      search({ characterName: '코드우선', serverId: 'cain', limit: 10 }),
      502
    )
    assert.deepEqual(error.body, {
      error: {
        code: 'NEOPLE_API_ERROR',
        message: '캐릭터 검색 중 오류가 발생했습니다.'
      }
    })
    assert.equal(requests, 1)
  } finally {
    await closeLoopback(loopback.server)
  }
})

test('loopback 본문을 수신하는 도중 deadline timer가 native fetch를 취소한다', {
  timeout: 2_000
}, async (t) => {
  let now = 0
  const captured: { signal?: AbortSignal } = {}
  let deadlineCallback: (() => void) | undefined
  let scheduledDelay: number | undefined
  let requests = 0
  let markResponseClosed: (() => void) | undefined
  const responseClosed = new Promise<void>((resolve) => {
    markResponseClosed = resolve
  })
  const loopback = await startLoopback((_request, response) => {
    requests += 1
    response.once('close', () => markResponseClosed?.())
    response.writeHead(200, { 'content-type': 'application/json' })
    response.flushHeaders()
    response.write('{"rows":[')
  })

  t.after(() => closeLoopback(loopback.server))

  const search = createNeopleCharacterSearchForTest('obvious-placeholder-key', {
    fetch: async (request, init) => {
      const isSignalNotNull = init?.signal !== null
      if (isSignalNotNull) {
        const isSignalDefined = init?.signal !== undefined
        if (isSignalDefined) {
          captured.signal = init.signal as AbortSignal
        }
      }
      const response = await fetch(request, init)

      const readText = response.text.bind(response)
      response.text = () => {
        // 실제 native body 소비를 시작한 직후 clock과 timer 경계만 제어한다.
        const body = readText()
        now = 5_000
        assert(deadlineCallback)
        deadlineCallback()

        return body
      }

      return response
    },
    origin: loopback.origin,
    now: () => now,
    setTimer: (callback, timeout) => {
      deadlineCallback = callback
      scheduledDelay = timeout

      return Symbol('timer')
    },
    clearTimer: () => undefined
  })

  const error = await expectStatus(
    search({ characterName: '본문지연', serverId: 'cain', limit: 10 }),
    504
  )
  assert.equal(error.body.error.code, 'NEOPLE_TIMEOUT')
  assert.equal(captured.signal?.aborted, true)
  assert.equal(scheduledDelay, 5_000)
  assert.equal(requests, 1)
  await responseClosed
})

test('timer 실행 전 clock이 deadline에 도달하면 미완료 native 본문을 취소한다', {
  timeout: 2_000
}, async (t) => {
  let now = 0
  const captured: { signal?: AbortSignal } = {}
  let scheduledDelay: number | undefined
  let timerCleared = false
  let requests = 0
  let markResponseClosed: (() => void) | undefined
  const responseClosed = new Promise<void>((resolve) => {
    markResponseClosed = resolve
  })
  const loopback = await startLoopback((_request, response) => {
    requests += 1
    response.once('close', () => markResponseClosed?.())
    response.writeHead(200, { 'content-type': 'application/json' })
    response.flushHeaders()
    response.write('{"rows":[')
  })

  t.after(() => closeLoopback(loopback.server))

  const search = createNeopleCharacterSearchForTest('obvious-placeholder-key', {
    fetch: async (request, init) => {
      const isSignalNotNull = init?.signal !== null
      if (isSignalNotNull) {
        const isSignalDefined = init?.signal !== undefined
        if (isSignalDefined) {
          captured.signal = init.signal as AbortSignal
        }
      }
      const response = await fetch(request, init)
      now = 5_000

      return response
    },
    origin: loopback.origin,
    now: () => now,
    setTimer: (_callback, timeout) => {
      scheduledDelay = timeout

      return Symbol('timer')
    },
    clearTimer: () => {
      timerCleared = true
    }
  })

  const error = await expectStatus(
    search({ characterName: '헤더지연', serverId: 'cain', limit: 10 }),
    504
  )
  assert.equal(error.body.error.code, 'NEOPLE_TIMEOUT')
  assert.equal(captured.signal?.aborted, true)
  assert.equal(scheduledDelay, 5_000)
  assert.equal(timerCleared, true)
  assert.equal(requests, 1)
  await responseClosed
})

test('native 본문이 headers 뒤에 끊기면 HTTP 503 fallback 대신 통신 오류 502를 반환한다', {
  timeout: 2_000
}, async (t) => {
  let headersReceived!: () => void
  const headers = new Promise<void>((resolve) => {
    headersReceived = resolve
  })
  let requests = 0
  const loopback = await startLoopback((_request, response) => {
    requests++
    response.writeHead(503, { 'content-type': 'application/json' })
    response.flushHeaders()
    response.write('{"error":')
    void headers.then(() => response.destroy())
  })
  t.after(() => closeLoopback(loopback.server))

  const search = createNeopleCharacterSearchForTest('obvious-placeholder-key', {
    fetch: async (request, init) => {
      const response = await fetch(request, init)
      assert.equal(response.status, 503)
      headersReceived()

      return response
    },
    origin: loopback.origin
  })
  await expectStatus(search({ characterName: '본문실패', serverId: 'all', limit: 10 }), 502)
  assert.equal(requests, 1)
})
