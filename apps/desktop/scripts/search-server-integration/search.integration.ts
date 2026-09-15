import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createSearchHttp, SearchHttpFailure } from '../../src/backend/search/http'
import { withSearchServer } from './runtime.mjs'

const apiOrigin = 'https://desktop-search.test.invalid'
const nickname = 'fixture'

// 후보 값은 외부 사용자 데이터가 아닌 명시적인 synthetic fixture다.
const upstreamRows = [
  {
    characterId: 'fixture-first',
    characterName: 'fixture',
    serverId: 'cain',
    fame: 0,
    ignored: true
  },
  {
    characterId: 'fixture-second',
    characterName: 'fixture',
    serverId: 'future-server',
    fame: -1.5
  },
  { characterId: 'fixture-third', characterName: 'fixture', serverId: 'anton' }
]

test('Desktop HTTP client consumes public API defaults and peer quota without credentials', async () => {
  await withSearchServer(async ({ base, neople }) => {
    const requests: Array<{ query: string; hasAuthorization: boolean }> = []
    const statuses: number[] = []
    const transport: typeof fetch = async (input, options) => {
      const request = new Request(input, options)
      const url = new URL(request.url)
      assert.equal(url.origin, apiOrigin, 'test transport must reject other origins')
      assert.equal(url.pathname, '/characters')
      const query = url.search
      const hasAuthorization = request.headers.has('authorization')
      requests.push({ query, hasAuthorization })
      const response = await fetch(new Request(`${base}${url.pathname}${url.search}`, request))
      statuses.push(response.status)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      return response
    }
    const search = createSearchHttp({
      apiOrigin,
      fetch: transport,
      clock: { read: () => ({ monotonicMs: 1234, wallMs: 0, discontinuous: false }) }
    })
    const searchInput = { nickname, signal: new AbortController().signal }
    neople.upstream.body = { rows: upstreamRows }
    const rows = await search(searchInput)

    assert.deepEqual(rows, [
      {
        characterId: 'fixture-first',
        characterName: nickname,
        serverId: 'cain',
        serverName: '카인',
        fame: 0
      },
      {
        characterId: 'fixture-second',
        characterName: nickname,
        serverId: 'future-server',
        serverName: null,
        fame: -1.5
      },
      {
        characterId: 'fixture-third',
        characterName: nickname,
        serverId: 'anton',
        serverName: '안톤',
        fame: null
      }
    ])
    assert.deepEqual(requests, [{ query: '?characterName=fixture', hasAuthorization: false }])
    assert.deepEqual(neople.calls, [
      {
        path: '/df/servers/all/characters',
        query: { characterName: nickname, limit: '10', wordType: 'full' },
        hasExpectedKey: true
      }
    ])

    neople.upstream.body = { rows: [] }
    assert.deepEqual(await search(searchInput), [])
    neople.upstream.body = { rows: [upstreamRows[0], { ...upstreamRows[1], fame: '0' }] }
    await assert.rejects(search(searchInput), { code: 'NEOPLE_API_ERROR' })
    assert.deepEqual(statuses, [200, 200, 502])
    assert.equal(neople.calls.length, 3, 'invalid upstream response is not retried')

    await assert.rejects(search({ ...searchInput, nickname: 'x' }), {
      code: 'INVALID_SEARCH_QUERY'
    })
    assert.equal(statuses.at(-1), 400)
    assert.equal(neople.calls.length, 3, 'invalid input must not reach upstream')

    neople.upstream.body = { rows: [] }
    for (let request = 3; request < 10; request += 1) {
      assert.deepEqual(await search(searchInput), [])
    }
    await assert.rejects(search(searchInput), (error: unknown) => {
      const isSearchHttpFailure = error instanceof SearchHttpFailure
      assert(isSearchHttpFailure)
      assert.equal(error.code, 'SEARCH_RATE_LIMITED')
      assert.equal(error.retryAfterReceivedAt, 1234)
      const seconds = error.retryAfterSeconds
      const hasSeconds = seconds != null
      const isSafeInteger = Number.isSafeInteger(seconds)
      const assertionMessage = 'Desktop must consume the real peer Retry-After header'
      if (!hasSeconds) {
        assert(false, assertionMessage)
        return true
      }
      const isPositiveWait = seconds > 0
      if (!isPositiveWait) {
        assert(false, assertionMessage)
        return true
      }
      const isInServerWindow = seconds <= 60
      const hasValidWait = isSafeInteger && isInServerWindow
      assert(hasValidWait, assertionMessage)
      return true
    })
    assert.equal(statuses.at(-1), 429)
    assert.equal(neople.calls.length, 10, 'quota rejection must not retry or call upstream')
    assert(
      requests.every(({ hasAuthorization }) => !hasAuthorization),
      'public search must never send credentials'
    )
  })
})
