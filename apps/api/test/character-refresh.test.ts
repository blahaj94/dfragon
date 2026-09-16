import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { createCharacterDetailService } from '../src/characters/details/service.js'
import { characterFreshness, CHARACTER_FRESHNESS_MS } from '../src/characters/details/freshness.js'
import { CharacterDetailFailure } from '../src/characters/details/errors.js'
import { characterDetailSections } from '../src/characters/details/sections.js'
import type { CharacterPayloads } from '../src/characters/details/sections.js'
import type { CharacterApiResponse } from '../src/database/schemas/character-api-responses.js'
import type { CharacterDetailStore } from '../src/characters/details/store.js'

const identity = { serverId: 'siroco', characterId: 'refresh-fixture' }
const signal = new AbortController().signal
const initialTime = Date.parse('2026-01-01T00:00:00Z')
const common = { ...identity, characterName: '합성 캐릭터', jobId: 'job' }
const payloads: CharacterPayloads = {
  basic: { ...common },
  status: { ...common, status: [], buff: [] },
  equipment: { ...common, equipment: [], setItemInfo: [] },
  avatar: { ...common, avatar: [] },
  creature: { ...common, creature: null },
  oath: { ...common, oath: null },
  mist_assimilation: { ...common, mistAssimilation: null },
  skill_style: { ...common, skill: { style: { active: [] } } },
  buff_equipment: { ...common, skill: { buff: null } },
  buff_avatar: { ...common, skill: { buff: null } },
  buff_creature: { ...common, skill: { buff: null } }
}
function rowsAt(time: number): CharacterApiResponse[] {
  return characterDetailSections.map((section) => ({
    characterId: identity.characterId,
    section,
    payload: structuredClone(payloads[section]),
    revision: 1,
    contentUpdatedAt: new Date(initialTime),
    lastSuccessfulFetchAt: new Date(time),
    requestStartedAt: new Date(time)
  }))
}
function memory(initial: CharacterApiResponse[] = []) {
  const state = { rows: initial, now: initialTime, reads: 0, starts: 0, writes: 0 }
  const store: CharacterDetailStore = {
    async read() {
      state.reads++
      return { rows: structuredClone(state.rows), now: new Date(state.now) }
    },
    async beginFetch() {
      state.starts++
      return new Date(state.now).toISOString()
    },
    async saveAndRead(_identity, incoming, _requestedAt, requestSignal) {
      requestSignal.throwIfAborted()
      state.writes++
      state.rows = rowsAt(state.now).map((row) => ({
        ...row,
        payload: structuredClone(incoming[row.section])
      }))
      return structuredClone(state.rows)
    }
  }
  return { state, store }
}

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

test('five-minute GET cache uses the oldest successful section fetch, not content changes', async (t) => {
  const { state, store } = memory(rowsAt(initialTime))
  let calls = 0
  const service = createCharacterDetailService({
    apiKey: 'fixture',
    store,
    fetchDetails: async () => {
      calls++
      return payloads
    }
  })
  t.after(() => service.onModuleDestroy())
  state.now = initialTime + CHARACTER_FRESHNESS_MS - 1
  const before = structuredClone(state.rows)
  const hit = await service.get('peer', identity, signal)
  assert.equal(calls, 0)
  assert.equal(state.writes, 0)
  assert.equal(state.starts, 0)
  assert.deepEqual(state.rows, before)
  assert.deepEqual(hit.freshness, {
    lastSuccessfulFetchAt: new Date(initialTime).toISOString(),
    expiresAt: new Date(initialTime + CHARACTER_FRESHNESS_MS).toISOString()
  })
  state.now++
  const renewed = await service.get('peer', identity, signal)
  assert.equal(calls, 1)
  assert.equal(state.writes, 1)
  assert.equal(renewed.freshness.lastSuccessfulFetchAt, new Date(state.now).toISOString())
  await service.refresh('peer', identity, signal)
  assert.equal(calls, 2)
  assert.equal(state.reads, 2)
  assert.equal(characterFreshness(rowsAt(initialTime).slice(1)), null)
  const mixed = rowsAt(initialTime + 1000)
  mixed[0]!.lastSuccessfulFetchAt = new Date(initialTime)
  assert.equal(
    characterFreshness(mixed)!.lastSuccessfulFetchAt,
    new Date(initialTime).toISOString()
  )
})

test('missing or incomplete snapshots refresh; read failures do not fall through to upstream', async (t) => {
  const { state, store } = memory()
  let calls = 0
  const service = createCharacterDetailService({
    apiKey: 'fixture',
    store,
    fetchDetails: async () => {
      calls++
      return payloads
    }
  })
  t.after(() => service.onModuleDestroy())
  await service.get('peer', identity, signal)
  state.rows.pop()
  await service.get('peer', identity, signal)
  assert.equal(calls, 2)
  assert.equal(state.rows.length, 11)
  store.read = async () => {
    throw new CharacterDetailFailure('api')
  }
  await assert.rejects(
    service.get('peer', identity, signal),
    (e: unknown) => e instanceof CharacterDetailFailure && e.status === 502
  )
  assert.equal(calls, 2)
})

test('failed auto or manual refresh preserves stored data and never returns stale success', async (t) => {
  const { state, store } = memory(rowsAt(initialTime))
  let failing = true
  const service = createCharacterDetailService({
    apiKey: 'fixture',
    store,
    fetchDetails: async () => {
      if (failing) {
        throw new CharacterDetailFailure('unavailable')
      }
      return payloads
    }
  })
  t.after(() => service.onModuleDestroy())
  const before = structuredClone(state.rows)
  await assert.rejects(service.refresh('peer', identity, signal), { status: 503 })
  assert.equal(state.writes, 0)
  assert.deepEqual(state.rows, before)
  assert((await service.get('peer', identity, signal)).freshness)
  state.now += CHARACTER_FRESHNESS_MS
  await assert.rejects(service.get('peer', identity, signal), { status: 503 })
  assert.deepEqual(state.rows, before)
  failing = false
  await service.get('peer', identity, signal)
  assert.equal(state.writes, 1)
})

test('GET hits and forced refresh share the per-IP ten-request quota', async (t) => {
  const { state, store } = memory(rowsAt(initialTime))
  let calls = 0
  const service = createCharacterDetailService({
    apiKey: 'fixture',
    store,
    fetchDetails: async () => {
      calls++
      return payloads
    }
  })
  t.after(() => service.onModuleDestroy())
  for (let i = 0; i < 9; i++) {
    await service.get('peer', identity, signal)
  }
  await service.refresh('peer', identity, signal)
  await assert.rejects(
    service.get('peer', identity, signal),
    (e: unknown) =>
      e instanceof CharacterDetailFailure && e.status === 429 && (e.retryAfter ?? 0) > 0
  )
  assert.equal(calls, 1)
  assert.equal(state.reads, 9)
  await service.get('other-peer', identity, signal)
  assert.equal(calls, 1)
})

test('concurrent GET and POST share refresh; one disconnect cannot cancel the surviving waiter', async (t) => {
  const { state, store } = memory(),
    entered = gate(),
    finish = gate()
  let calls = 0,
    sharedSignal: AbortSignal | undefined
  const service = createCharacterDetailService({
    apiKey: 'fixture',
    store,
    fetchDetails: async (_identity, s) => {
      calls++
      sharedSignal = s
      entered.release()
      await finish.promise
      return payloads
    }
  })
  t.after(() => service.onModuleDestroy())
  const disconnected = new AbortController()
  const first = service.get('peer-a', identity, disconnected.signal)
  const rejection = assert.rejects(first)
  await entered.promise
  const second = service.refresh('peer-b', identity, signal)
  await nextTurn()
  disconnected.abort()
  await rejection
  assert.equal(sharedSignal!.aborted, false)
  finish.release()
  assert.equal((await second).character.characterName, '합성 캐릭터')
  assert.equal(calls, 1)
  assert.equal(state.starts, 1)
  assert.equal(state.writes, 1)
})

test('last waiter cancellation aborts work, prevents late persistence and allows a new request', async (t) => {
  const { state, store } = memory(),
    entered = gate(),
    late = gate()
  let calls = 0,
    abortedSignal: AbortSignal | undefined
  const service = createCharacterDetailService({
    apiKey: 'fixture',
    store,
    fetchDetails: async (_identity, s) => {
      calls++
      if (calls === 1) {
        abortedSignal = s
        entered.release()
        await late.promise
      }
      return payloads
    }
  })
  t.after(() => service.onModuleDestroy())
  const controller = new AbortController(),
    first = service.get('peer', identity, controller.signal),
    rejected = assert.rejects(first)
  await entered.promise
  controller.abort()
  await rejected
  assert.equal(abortedSignal!.aborted, true)
  await service.get('peer', identity, signal)
  assert.equal(state.writes, 1)
  assert.equal(calls, 2)
  late.release()
  await nextTurn()
  assert.equal(state.writes, 1)
})

test('shared failure is removed for retry and shutdown waits for aborted work cleanup', async (t) => {
  const { state, store } = memory(),
    entered = gate(),
    finish = gate()
  let calls = 0
  const service = createCharacterDetailService({
    apiKey: 'fixture',
    store,
    fetchDetails: async () => {
      calls++
      entered.release()
      await finish.promise
      throw new CharacterDetailFailure('unavailable')
    }
  })
  t.after(() => service.onModuleDestroy())
  const first = service.refresh('one', identity, signal),
    second = service.refresh('two', identity, signal)
  const failures = Promise.all([
    assert.rejects(first, { status: 503 }),
    assert.rejects(second, { status: 503 })
  ])
  await entered.promise
  finish.release()
  await failures
  assert.equal(calls, 1)
  await assert.rejects(service.refresh('one', identity, signal), { status: 503 })
  assert.equal(calls, 2)
  assert.equal(state.writes, 0)

  const start = gate(),
    cleanup = gate(),
    stopped = new AbortController()
  const shutting = createCharacterDetailService({
    apiKey: 'fixture',
    store,
    fetchDetails: async (_identity, s) => {
      start.release()
      s.addEventListener('abort', () => stopped.abort(), { once: true })
      await cleanup.promise
      return payloads
    }
  })
  const pending = shutting.refresh('three', identity, signal),
    rejected = assert.rejects(pending)
  await start.promise
  let closed = false
  const closing = shutting.onModuleDestroy().then(() => {
    closed = true
  })
  await rejected
  assert.equal(stopped.signal.aborted, true)
  assert.equal(closed, false)
  cleanup.release()
  await closing
  assert.equal(state.writes, 0)
})

test('starting a refresh times out and a late DB timestamp cannot trigger upstream work', async (t) => {
  const { state, store } = memory()
  const late = gate()
  let calls = 0
  store.beginFetch = async () => {
    await late.promise
    return new Date(initialTime).toISOString()
  }
  const service = createCharacterDetailService({
    apiKey: 'fixture',
    store,
    fetchDetails: async () => {
      calls++
      return payloads
    }
  })
  t.after(async () => {
    late.release()
    await service.onModuleDestroy()
  })
  await assert.rejects(service.refresh('peer', identity, signal), { status: 500 })
  await service.onModuleDestroy()
  late.release()
  await nextTurn()
  assert.equal(calls, 0)
  assert.equal(state.writes, 0)
})

test('shutdown cancels waiting for the DB refresh timestamp without waiting for its result', async (t) => {
  const { state, store } = memory()
  const entered = gate()
  const late = gate()
  let calls = 0
  store.beginFetch = async () => {
    entered.release()
    await late.promise
    return new Date(initialTime).toISOString()
  }
  const service = createCharacterDetailService({
    apiKey: 'fixture',
    store,
    fetchDetails: async () => {
      calls++
      return payloads
    }
  })
  t.after(async () => {
    late.release()
    await service.onModuleDestroy()
  })
  const rejected = assert.rejects(service.refresh('peer', identity, signal))
  await entered.promise
  await service.onModuleDestroy()
  await rejected
  late.release()
  await nextTurn()
  assert.equal(calls, 0)
  assert.equal(state.writes, 0)
})
