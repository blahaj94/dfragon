import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { createCharacterDetailService } from '../src/characters/details/service.js'
import { characterFreshness } from '../src/characters/details/freshness.js'
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
  return characterDetailSections.map((section) => {
    const characterId = identity.characterId
    const payload = structuredClone(payloads[section])
    const contentUpdatedAt = new Date(initialTime)
    const lastSuccessfulFetchAt = new Date(time)
    const requestStartedAt = new Date(time)

    return {
      characterId,
      section,
      payload,
      revision: 1,
      contentUpdatedAt,
      lastSuccessfulFetchAt,
      requestStartedAt
    }
  })
}
function memory(initial: CharacterApiResponse[] = []) {
  const state = { rows: initial, now: initialTime, reads: 0, starts: 0, writes: 0 }
  const store: CharacterDetailStore = {
    async read() {
      state.reads++
      const rows = structuredClone(state.rows)
      const now = new Date(state.now)

      return { rows, now }
    },
    async beginFetch() {
      state.starts++

      return new Date(state.now).toISOString()
    },
    async saveAndRead(_identity, incoming, _requestedAt, requestSignal) {
      requestSignal.throwIfAborted()
      state.writes++
      state.rows = rowsAt(state.now).map((row) => {
        const snapshot = { ...row }
        const payload = structuredClone(incoming[row.section])

        return { ...snapshot, payload }
      })

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

test('GET은 가장 오래된 성공 조회부터 정확히 5분에 만료되고 캐시 적중은 저장값을 바꾸지 않는다', async (t) => {
  for (const [name, elapsed, refreshes] of [
    ['5분 만료 1ms 전', 299_999, 0],
    ['정확히 5분 만료', 300_000, 1],
    ['5분 만료 1ms 후', 300_001, 1]
  ] as const) {
    await t.test(name, async (t) => {
      const rows = rowsAt(initialTime + 120_000)
      rows.find((row) => row.section === 'status')!.lastSuccessfulFetchAt = new Date(initialTime)
      const { state, store } = memory(rows)
      state.now = initialTime + elapsed
      const before = structuredClone(state.rows)
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

      const result = await service.get('192.0.2.1', identity, signal)

      assert.equal(calls, refreshes)
      assert.equal(state.starts, refreshes)
      assert.equal(state.writes, refreshes)
      assert.equal(result.character.characterName, '합성 캐릭터')
      if (refreshes === 0) {
        assert.deepEqual(state.rows, before)
        assert.deepEqual(result.freshness, {
          lastSuccessfulFetchAt: '2026-01-01T00:00:00.000Z',
          expiresAt: '2026-01-01T00:05:00.000Z'
        })
      } else {
        assert.deepEqual(result.freshness, {
          lastSuccessfulFetchAt: new Date(state.now).toISOString(),
          expiresAt: new Date(state.now + 300_000).toISOString()
        })
      }
    })
  }
  assert.equal(characterFreshness(rowsAt(initialTime).slice(1)), null)
})

test('최초·누락된 저장값은 전체 갱신하고 DB 읽기 실패는 정제된 내부 오류로 중단한다', async (t) => {
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
  await service.get('192.0.2.1', identity, signal)
  state.rows.pop()
  await service.get('192.0.2.1', identity, signal)
  assert.equal(calls, 2)
  assert.equal(state.rows.length, 11)
  store.read = async () => {
    throw new Error('fixture SQL failure with private database detail')
  }
  await assert.rejects(service.get('192.0.2.1', identity, signal), (error: unknown) => {
    assert(error instanceof CharacterDetailFailure)
    assert.equal(error.status, 500)
    assert.deepEqual(error.body, {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 오류로 캐릭터 정보를 처리하지 못했습니다.'
      }
    })

    return true
  })
  assert.equal(calls, 2)
})

test('자동·명시 갱신 실패는 기존 저장값을 보존하고 만료된 응답을 성공처럼 반환하지 않는다', async (t) => {
  const { state, store } = memory(rowsAt(initialTime))
  state.now += 30_000
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
  await assert.rejects(service.refresh('192.0.2.1', identity, signal), { status: 503 })
  assert.equal(state.writes, 0)
  assert.deepEqual(state.rows, before)
  const cached = await service.get('192.0.2.1', identity, signal)
  assert.equal(cached.character.characterName, '합성 캐릭터')
  assert.deepEqual(cached.freshness, {
    lastSuccessfulFetchAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-01T00:05:00.000Z'
  })
  state.now += 300_000
  await assert.rejects(service.get('192.0.2.1', identity, signal), { status: 503 })
  assert.deepEqual(state.rows, before)
  failing = false
  await service.get('192.0.2.1', identity, signal)
  assert.equal(state.writes, 1)
})

test('GET 캐시 적중과 명시 갱신은 IP별 10회 한도를 함께 소비한다', async (t) => {
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
    await service.get('192.0.2.1', identity, signal)
  }
  state.now += 30_000
  await service.refresh('192.0.2.1', identity, signal)
  await assert.rejects(
    service.get('192.0.2.1', identity, signal),
    (e: unknown) =>
      e instanceof CharacterDetailFailure && e.status === 429 && (e.retryAfter ?? 0) > 0
  )
  assert.equal(calls, 1)
  assert.equal(state.reads, 10)
  await service.get('192.0.2.2', identity, signal)
  assert.equal(calls, 1)
})

test('다른 IP의 명시 갱신도 캐릭터별 30초 cooldown과 남은 초를 지킨다', async (t) => {
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
  await service.refresh('192.0.2.1', identity, signal)
  await assert.rejects(service.refresh('192.0.2.2', identity, signal), {
    status: 429,
    retryAfter: 30
  })
  assert.equal(
    (await service.get('192.0.2.2', identity, signal)).freshness.lastSuccessfulFetchAt,
    '2026-01-01T00:00:00.000Z'
  )
  state.now += 30_000 - 1
  await assert.rejects(service.refresh('192.0.2.3', identity, signal), {
    status: 429,
    retryAfter: 1
  })
  assert.equal(calls, 1)
  assert.equal(state.writes, 1)
  state.now++
  await service.refresh('192.0.2.3', identity, signal)
  assert.equal(calls, 2)
  assert.equal(state.writes, 2)
})

test('GET과 명시 갱신은 작업을 공유하고 한 대기자의 연결 종료는 다른 대기자를 취소하지 않는다', async (t) => {
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
  t.after(async () => {
    finish.release()
    await service.onModuleDestroy()
  })
  const disconnected = new AbortController()
  const first = service.get('192.0.2.1', identity, disconnected.signal)
  const rejection = assert.rejects(first)
  await entered.promise
  const second = service.refresh('192.0.2.2', identity, signal)
  void second.catch(() => undefined)
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

test('마지막 대기자가 취소하면 지연 응답을 저장하지 않고 새 요청은 독립 갱신한다', async (t) => {
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
  t.after(async () => {
    late.release()
    await service.onModuleDestroy()
  })
  const controller = new AbortController(),
    first = service.get('192.0.2.1', identity, controller.signal),
    rejected = assert.rejects(first)
  await entered.promise
  controller.abort()
  await rejected
  assert.equal(abortedSignal!.aborted, true)
  await service.get('192.0.2.1', identity, signal)
  assert.equal(state.writes, 1)
  assert.equal(calls, 2)
  late.release()
  await nextTurn()
  assert.equal(state.writes, 1)
})

test('공유 갱신 실패 뒤 새 요청을 허용하고 서버 종료는 취소된 작업 정리를 기다린다', async (t) => {
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

test('갱신 시작 DB 시각 조회가 2초를 넘으면 늦은 결과로 upstream·저장을 시작하지 않는다', async (t) => {
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
  await assert.rejects(service.refresh('192.0.2.1', identity, signal), { status: 500 })
  await service.onModuleDestroy()
  late.release()
  await nextTurn()
  assert.equal(calls, 0)
  assert.equal(state.writes, 0)
})

test('서버 종료는 갱신 시작 DB 시각 대기를 취소하고 늦은 결과를 처리하지 않는다', async (t) => {
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
  const rejected = assert.rejects(service.refresh('192.0.2.1', identity, signal))
  await entered.promise
  await service.onModuleDestroy()
  await rejected
  late.release()
  await nextTurn()
  assert.equal(calls, 0)
  assert.equal(state.writes, 0)
})

test('가장 오래된 성공 조회가 DB 현재 시각보다 미래이면 저장값을 유효한 캐시로 쓰지 않는다', async (t) => {
  const { state, store } = memory(rowsAt(initialTime + 1))
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

  const result = await service.get('192.0.2.1', identity, signal)

  assert.equal(calls, 1)
  assert.equal(state.starts, 1)
  assert.equal(state.writes, 1)
  assert.deepEqual(result.freshness, {
    lastSuccessfulFetchAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-01T00:05:00.000Z'
  })
})

test(
  '명시 갱신 진행 중에도 유효한 GET 캐시는 즉시 기존 값을 제공하고 완료 뒤 새 저장값을 반환한다',
  { timeout: 2000 },
  async (t) => {
    const { state, store } = memory(rowsAt(initialTime))
    state.now += 30_000
    const entered = gate()
    const finish = gate()
    const updated = structuredClone(payloads)
    for (const section of characterDetailSections) {
      updated[section].characterName = '갱신 캐릭터'
    }
    let calls = 0
    const service = createCharacterDetailService({
      apiKey: 'fixture',
      store,
      fetchDetails: async () => {
        calls++
        entered.release()
        await finish.promise

        return updated
      }
    })
    t.after(async () => {
      finish.release()
      await service.onModuleDestroy()
    })
    const pending = service.refresh('192.0.2.1', identity, signal)
    await entered.promise

    const cached = await service.get('192.0.2.2', identity, signal)
    assert.equal(cached.character.characterName, '합성 캐릭터')
    assert.deepEqual(cached.freshness, {
      lastSuccessfulFetchAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T00:05:00.000Z'
    })
    assert.equal(calls, 1)
    assert.equal(state.writes, 0)
    finish.release()
    const refreshed = await pending
    assert.equal(refreshed.character.characterName, '갱신 캐릭터')
    assert.deepEqual(refreshed.freshness, {
      lastSuccessfulFetchAt: '2026-01-01T00:00:30.000Z',
      expiresAt: '2026-01-01T00:05:30.000Z'
    })
    assert.equal(state.writes, 1)
    assert.equal(
      (await service.get('192.0.2.2', identity, signal)).character.characterName,
      '갱신 캐릭터'
    )
    assert.equal(calls, 1)
  }
)
