import assert from 'node:assert/strict'
import test from 'node:test'
import { createLoginHttpApp } from '../src/auth/login/http.js'
import { parseAdventureSearchQuery } from '../src/adventures/query.js'
import { createAdventureSearchService } from '../src/adventures/service.js'

const url = '/adventures/characters?adventureName=' + encodeURIComponent('합성모험단')
const empty = { adventureName: '합성모험단', scope: 'stored' as const, rows: [], nextAfter: null }

test('adventure query preserves exact names and validates pagination and raw duplicate parameters', () => {
  assert.deepEqual(parseAdventureSearchQuery(url), {
    adventureName: '합성모험단',
    limit: 100,
    after: null
  })
  assert.deepEqual(parseAdventureSearchQuery(url + '&limit=2&after=fixture-id'), {
    adventureName: '합성모험단',
    limit: 2,
    after: 'fixture-id'
  })
  assert.equal(parseAdventureSearchQuery('/?adventureName=%25_%27').adventureName, "%_'")
  for (const invalid of [
    '/adventures/characters',
    '/?adventureName=',
    '/?adventureName=++',
    '/?adventureName=%00',
    '/?adventureName=%FF',
    '/?adventureName=' + '가'.repeat(101),
    url + '&adventure%4Eame=duplicate',
    url + '&limit=1&limit=2',
    url + '&serverId=siroco',
    url + '&limit=0',
    url + '&limit=101',
    url + '&limit=1.5',
    url + '&limit=1e2',
    url + '&after=',
    url + '&after=../id',
    url + '&',
    url + '&unknown'
  ]) {
    assert.throws(() => parseAdventureSearchQuery(invalid), { status: 400 })
  }
})

test('adventure HTTP is public, bounded, no-store and sanitizes DB failures', async () => {
  let calls = 0,
    failing = false
  const unused = async (): Promise<never> => {
    throw new Error('Unrelated service called')
  }
  const app = await createLoginHttpApp(
    { create: unused, exchange: unused, authorize: unused, manage: unused, browser: unused },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    {
      search: async (input) => {
        calls++
        assert.deepEqual(input, { adventureName: '합성모험단', limit: 100, after: null })
        if (failing) {
          throw new Error('private SQL and connection details')
        }
        return empty
      }
    }
  )
  try {
    await app.listen(0, '127.0.0.1')
    const origin = await app.getUrl()
    for (const [suffix, method] of [
      ['', 'HEAD'],
      ['&limit=0', 'GET'],
      ['&adventureName=x', 'GET']
    ]) {
      assert.equal((await fetch(origin + url + suffix, { method })).status, 400)
    }
    assert.equal(calls, 0)
    const response = await fetch(origin + url)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), empty)
    failing = true
    const failed = await fetch(origin + url)
    assert.equal(failed.status, 500)
    assert.deepEqual(await failed.json(), {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 오류로 캐릭터 정보를 처리하지 못했습니다.'
      }
    })
    failing = false
    for (let i = 0; i < 8; i++) {
      assert.equal((await fetch(origin + url)).status, 200)
    }
    const limited = await fetch(origin + url)
    assert.equal(limited.status, 429)
    assert(Number(limited.headers.get('retry-after')) > 0)
    assert.equal(calls, 10)
  } finally {
    await app.close()
  }
})

test('shutdown aborts an active adventure read, waits for cleanup, and rejects late success', async () => {
  let entered!: () => void, finish!: () => void
  const started = new Promise<void>((resolve) => {
    entered = resolve
  })
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  let readSignal: AbortSignal | undefined
  const service = createAdventureSearchService({
    search: async (_input, signal) => {
      readSignal = signal
      entered()
      await pending
      return empty
    }
  })
  const rejected = assert.rejects(service.search('peer', url, new AbortController().signal), {
    status: 500
  })
  await started
  let closed = false
  const closing = service.onModuleDestroy().then(() => {
    closed = true
  })
  assert.equal(readSignal!.aborted, true)
  assert.equal(closed, false)
  finish()
  await rejected
  await closing
  await assert.rejects(service.search('peer', url, new AbortController().signal), { status: 500 })
})
