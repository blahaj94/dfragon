import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { URL } from 'node:url'
import { createApiHttpApp } from '../dist/http.js'
import { createNeopleCharacterSearchForTest } from '../dist/characters/neople-character-search.js'

export async function isolatedNeople() {
  const calls = []
  const sockets = new Set()
  const upstream = {
    status: 200,
    body: { rows: [] },
    respond: undefined,
    start: undefined,
    failure: undefined
  }
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://loopback.invalid')
    calls.push({
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      hasExpectedKey: request.headers.apikey === 'synthetic-search-key'
    })
    const hasCustomResponse = upstream.respond != null
    if (hasCustomResponse) {
      void Promise.resolve(upstream.respond(request, response)).catch((error) => {
        upstream.failure = error
        response.destroy()
      })

      return
    }
    response.writeHead(upstream.status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(upstream.body))
  })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const origin = `http://127.0.0.1:${port}`

  return {
    origin,
    calls,
    upstream,
    close: async () => {
      for (const socket of sockets) {
        socket.destroy()
      }
      await new Promise((resolve, reject) =>
        server.close((error) => {
          const hasError = error != null
          if (hasError) {
            reject(error)
          } else {
            resolve()
          }
        })
      )
    }
  }
}

export async function withSearchApp(operation, overrides = {}) {
  const neople = await isolatedNeople()
  const { calls, upstream } = neople
  const adapter = createNeopleCharacterSearchForTest('synthetic-search-key', {
    fetch,
    origin: neople.origin
  })
  const searchCharacters = (input) => {
    upstream.start?.()

    return adapter(input)
  }
  const deps = {
    searchCharacters,
    ...overrides
  }
  const app = await createApiHttpApp(deps)
  try {
    await app.listen(0, '127.0.0.1')
    const result = await operation({ base: await app.getUrl(), calls, upstream, deps, app })
    assert.equal(upstream.failure, undefined)

    return result
  } finally {
    await app.close()
    await neople.close()
  }
}

export async function expectSearchError(response, status, code) {
  assert.equal(response.status, status)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(response.headers.get('content-type'), /^application\/json/)
  const body = await response.json()
  const messages = {
    INVALID_SEARCH_QUERY: '검색 조건을 확인해 주세요.',
    INTERNAL_SERVER_ERROR: '서버 오류로 검색을 처리하지 못했습니다.',
    NEOPLE_API_ERROR: '캐릭터 검색 중 오류가 발생했습니다.',
    NEOPLE_UNAVAILABLE: '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    NEOPLE_TIMEOUT: '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.'
  }
  const message = messages[code]
  assert.equal(typeof message, 'string')
  assert.deepEqual(body, { error: { code, message } })

  return body
}
