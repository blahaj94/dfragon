import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCharacterSearchService } from '../dist/characters/search-service.js'

const originalUrl = '/characters?characterName=ab'

function fixture(overrides = {}) {
  let now = 0
  const calls = []
  const timers = new Map()
  const clock = {
    now: () => now,
    setTimer(callback, delay) {
      const id = Symbol()
      timers.set(id, { callback, at: now + delay })

      return id
    },
    clearTimer: (id) => timers.delete(id)
  }
  const service = createCharacterSearchService({
    apiKey: 'synthetic-search-key',
    clock,
    searchCharacters: async (input) => {
      calls.push(input)

      return { rows: [] }
    },
    ...overrides
  })

  return {
    service,
    calls,
    advance: (value) => {
      now = value
    }
  }
}

test('검색은 query를 먼저 검증하고 설정 실패 때 공급자를 호출하지 않는다', async () => {
  const f = fixture({ apiKey: '' })
  try {
    await assert.rejects(f.service.search('127.0.0.1', '/characters?characterName='), {
      status: 400,
      body: { error: { code: 'INVALID_SEARCH_QUERY', message: '검색 조건을 확인해 주세요.' } }
    })
    await assert.rejects(f.service.search('127.0.0.1', originalUrl), {
      status: 500,
      body: {
        error: { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류로 검색을 처리하지 못했습니다.' }
      }
    })
    assert.equal(f.calls.length, 0)
  } finally {
    await f.service.onModuleDestroy()
  }
})

test('동시 검색 열한 건 중 열 건만 호출하고 다른 IP와 만료 시각의 요청은 허용한다', async () => {
  const f = fixture()
  try {
    const results = await Promise.allSettled(
      Array.from({ length: 11 }, () => f.service.search('127.0.0.1', originalUrl))
    )
    const successes = results.filter((result) => result.status === 'fulfilled')
    const failures = results.filter((result) => result.status === 'rejected')
    assert.equal(successes.length, 10)
    for (const success of successes) {
      assert.deepEqual(success.value, { rows: [] })
    }
    assert.equal(failures.length, 1)
    assert.equal(failures[0].reason.status, 429)
    assert.equal(failures[0].reason.retryAfter, 60)
    assert.deepEqual(failures[0].reason.body, {
      error: {
        code: 'SEARCH_RATE_LIMITED',
        message: '검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
      }
    })
    assert.equal(f.calls.length, 10)
    assert.deepEqual(await f.service.search('127.0.0.2', originalUrl), { rows: [] })
    f.advance(59_999)
    await assert.rejects(f.service.search('127.0.0.1', originalUrl), { status: 429, retryAfter: 1 })
    f.advance(60_000)
    assert.deepEqual(await f.service.search('127.0.0.1', originalUrl), { rows: [] })
    assert.equal(f.calls.length, 12)
  } finally {
    await f.service.onModuleDestroy()
  }
})

test('IP 누락·이미 취소된 요청·종료 후 검색은 공급자를 호출하지 않는다', async () => {
  const f = fixture()
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(f.service.search(undefined, originalUrl), { status: 500 })
  await assert.rejects(f.service.search('127.0.0.1', originalUrl, controller.signal), {
    status: 500
  })
  await f.service.onModuleDestroy()
  await assert.rejects(f.service.search('127.0.0.1', originalUrl), { status: 500 })
  assert.equal(f.calls.length, 0)
})

test('공급자 실패도 예약을 소비하고 미분류 내부 오류를 정제한다', async () => {
  let calls = 0
  const f = fixture({
    searchCharacters: async () => {
      calls++
      throw new Error('private detail')
    }
  })
  try {
    for (let index = 0; index < 10; index++) {
      await assert.rejects(f.service.search('127.0.0.1', originalUrl), (error) => {
        assert.equal(error.status, 500)
        assert.deepEqual(error.body, {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: '서버 오류로 검색을 처리하지 못했습니다.'
          }
        })

        return true
      })
    }
    await assert.rejects(f.service.search('127.0.0.1', originalUrl), { status: 429 })
    assert.equal(calls, 10)
  } finally {
    await f.service.onModuleDestroy()
  }
})
