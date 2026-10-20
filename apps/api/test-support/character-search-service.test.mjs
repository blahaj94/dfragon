import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCharacterSearchService } from '../dist/characters/search-service.js'

const originalUrl = '/characters?characterName=ab'

function fixture(overrides = {}) {
  const calls = []
  const service = createCharacterSearchService({
    searchCharacters: async (input) => {
      calls.push(input)

      return { rows: [] }
    },
    ...overrides
  })

  return { service, calls }
}

test('검색은 잘못된 query를 공급자 호출 전에 거절한다', async () => {
  const f = fixture()
  try {
    await assert.rejects(f.service.search('127.0.0.1', '/characters?characterName='), {
      status: 400,
      body: { error: { code: 'INVALID_SEARCH_QUERY', message: '검색 조건을 확인해 주세요.' } }
    })
    assert.equal(f.calls.length, 0)
  } finally {
    await f.service.onModuleDestroy()
  }
})

test('같은 IP의 동시 검색 열두 건을 IP별 한도 없이 모두 공급자에 보낸다', async () => {
  const f = fixture()
  try {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => f.service.search('127.0.0.1', originalUrl))
    )
    for (const result of results) {
      assert.deepEqual(result, { rows: [] })
    }
    assert.equal(f.calls.length, 12)
  } finally {
    await f.service.onModuleDestroy()
  }
})

test('IP 누락, 이미 취소된 요청, 종료 후 검색은 공급자를 호출하지 않는다', async () => {
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

test('공급자의 미분류 실패는 내부 오류로 정제하고 이후 검색을 막지 않는다', async () => {
  let calls = 0
  const f = fixture({
    searchCharacters: async () => {
      calls++
      throw new Error('private detail')
    }
  })
  try {
    for (let index = 0; index < 11; index++) {
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
    assert.equal(calls, 11)
  } finally {
    await f.service.onModuleDestroy()
  }
})
