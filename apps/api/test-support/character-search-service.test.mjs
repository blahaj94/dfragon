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

test('public search validates query and configuration before upstream, with no identity dependency', async () => {
  let lengthReads = 0
  const f = fixture({
    apiKey: Object.defineProperty({}, 'length', {
      get() {
        lengthReads++
        throw new Error('must not inspect invalid API key')
      }
    })
  })
  try {
    await assert.rejects(f.service.search('127.0.0.1', '/characters?characterName='), {
      status: 400
    })
    await assert.rejects(f.service.search('127.0.0.1', originalUrl), { status: 500 })
    assert.equal(lengthReads, 0)
    assert.equal(f.calls.length, 0)
  } finally {
    await f.service.onModuleDestroy()
  }
})

test('public search shares peer quota across concurrent requests, isolates other peers and expires reservations', async () => {
  const f = fixture()
  try {
    const results = await Promise.allSettled(
      Array.from({ length: 11 }, () => f.service.search('127.0.0.1', originalUrl))
    )
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 10)
    assert.equal(results.find((result) => result.status === 'rejected').reason.status, 429)
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

test('public search rejects missing peer, aborted requests and shutdown without upstream', async () => {
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

test('public search retains reservations for upstream failures and sanitizes unclassified errors', async () => {
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
        assert.doesNotMatch(JSON.stringify(error), /private detail/)
        return true
      })
    }
    await assert.rejects(f.service.search('127.0.0.1', originalUrl), { status: 429 })
    assert.equal(calls, 10)
  } finally {
    await f.service.onModuleDestroy()
  }
})
