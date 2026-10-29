import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createCharacterDetailService } from '../src/characters/details/service.js'
import { CharacterDetailFailure } from '../src/characters/details/errors.js'
import type { NeopleStageTimings } from '../src/characters/details/neople-stages.js'
import type { CharacterPayloads } from '../src/characters/details/sections.js'

const identity = { serverId: 'siroco', characterId: 'refresh-fixture' }
const signal = new AbortController().signal
const catalog = createCatalogService(async () => new Map())
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

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return { promise, release }
}

test('끝난 요청을 재사용하지 않고 매번 Neople에서 받는다', async (t) => {
  let calls = 0
  const service = createCharacterDetailService({
    catalog,
    fetchDetails: async () => {
      calls++

      return payloads
    }
  })
  t.after(() => service.onModuleDestroy())

  const first = await service.get(identity, signal)
  await service.get(identity, signal)

  assert.equal(calls, 2)
  assert.equal(first.character.characterName, '합성 캐릭터')
})

test('상세 응답 JSON은 섹션마다 revision 1과 조회 시각을, freshness에 조회 시각과 5분 뒤 만료를 담는다', async (t) => {
  const fetchedAt = '2026-10-29T00:00:00.000Z'
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(fetchedAt) })
  const service = createCharacterDetailService({ catalog, fetchDetails: async () => payloads })
  t.after(() => service.onModuleDestroy())

  const result = await service.get(identity, signal)

  const metadata = { revision: 1, contentUpdatedAt: fetchedAt, lastSuccessfulFetchAt: fetchedAt }
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    character: {
      ...identity,
      serverName: '시로코',
      characterName: '합성 캐릭터',
      level: null,
      jobId: 'job',
      jobGrowId: null,
      jobName: null,
      jobGrowName: null,
      fame: null,
      adventureName: null,
      guildId: null,
      guildName: null
    },
    status: { status: [], buff: [] },
    equipment: { equipment: [], setItemInfo: [] },
    avatar: [],
    creature: null,
    oath: null,
    mistAssimilation: null,
    skillStyle: { style: { active: [] } },
    buff: { equipment: null, avatar: null, creature: null },
    sections: {
      basic: metadata,
      status: metadata,
      equipment: metadata,
      avatar: metadata,
      creature: metadata,
      oath: metadata,
      mist_assimilation: metadata,
      skill_style: metadata,
      buff_equipment: metadata,
      buff_avatar: metadata,
      buff_creature: metadata
    },
    freshness: { lastSuccessfulFetchAt: fetchedAt, expiresAt: '2026-10-29T00:05:00.000Z' },
    card: {
      role: null,
      stats: null,
      score: null,
      serverRank: null,
      set: null,
      oath: null,
      investment: []
    }
  })
})

test('겹친 요청은 작업을 공유하고 한 대기자의 연결 종료는 다른 대기자를 취소하지 않는다', async (t) => {
  const entered = gate(),
    finish = gate()
  let calls = 0,
    sharedSignal: AbortSignal | undefined
  const service = createCharacterDetailService({
    catalog,
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
  const first = service.get(identity, disconnected.signal)
  const rejection = assert.rejects(first)
  await entered.promise
  const second = service.get(identity, signal)
  second.catch(() => undefined)
  await nextTurn()
  disconnected.abort()
  await rejection
  assert.equal(sharedSignal!.aborted, false)
  finish.release()
  assert.equal((await second).character.characterName, '합성 캐릭터')
  assert.equal(calls, 1)
})

test('겹친 요청의 대기자들은 같은 조회 시각의 freshness와 sections를 받는다', async (t) => {
  const entered = gate(),
    finish = gate()
  let calls = 0
  const service = createCharacterDetailService({
    catalog,
    fetchDetails: async () => {
      calls++
      entered.release()
      await finish.promise

      return payloads
    }
  })
  t.after(async () => {
    finish.release()
    await service.onModuleDestroy()
  })
  const RealDate = Date
  let now = RealDate.parse('2026-10-29T00:00:00.000Z')
  // Every new Date() moves the clock, so a timestamp taken per waiter would differ.
  class SteppingDate extends RealDate {
    constructor(value?: number | string | Date) {
      if (value === undefined) {
        now += 1000
        super(now)
      } else {
        super(value)
      }
    }
  }
  globalThis.Date = SteppingDate as DateConstructor
  try {
    const first = service.get(identity, signal)
    await entered.promise
    const second = service.get(identity, signal)
    await nextTurn()
    finish.release()
    const [a, b] = await Promise.all([first, second])

    assert.equal(calls, 1)
    assert.deepEqual(a.freshness, b.freshness)
    assert.deepEqual(a.sections, b.sections)
  } finally {
    globalThis.Date = RealDate
  }
})

test('공유 조회를 기다린 요청들은 늦게 합류해도 같은 Neople 단계 시간을 받고, 합류한 요청만 공유로 표시한다', async (t) => {
  const basicDone = gate(),
    finish = gate()
  let calls = 0
  const service = createCharacterDetailService({
    catalog,
    fetchDetails: async (_identity, _signal, recordStage) => {
      calls++
      recordStage?.('basic', 12)
      basicDone.release()
      await finish.promise
      recordStage?.('sections', 34)

      return payloads
    }
  })
  t.after(async () => {
    finish.release()
    await service.onModuleDestroy()
  })
  function collectTimings() {
    const stages: Record<string, number> = {}
    let shared = false

    return {
      stages,
      isShared: () => shared,
      timings: {
        record: (stage, durationMs) => {
          stages[stage] = durationMs
        },
        markShared: () => {
          shared = true
        }
      } satisfies NeopleStageTimings
    }
  }
  const owner = collectTimings(),
    joiner = collectTimings()

  const first = service.get(identity, signal, owner.timings)
  await basicDone.promise
  const second = service.get(identity, signal, joiner.timings)
  finish.release()
  await Promise.all([first, second])

  assert.equal(calls, 1)
  for (const { stages } of [owner, joiner]) {
    const { catalog: catalogMs, ...neople } = stages
    assert.deepEqual(neople, { basic: 12, sections: 34 })
    assert(Number.isInteger(catalogMs) && catalogMs! >= 0)
  }
  assert.equal(owner.isShared(), false)
  assert.equal(joiner.isShared(), true)
})

test('마지막 대기자가 취소하면 공유 작업을 취소하고 새 요청은 독립 조회한다', async (t) => {
  const entered = gate(),
    late = gate()
  let calls = 0,
    abortedSignal: AbortSignal | undefined
  const service = createCharacterDetailService({
    catalog,
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
    first = service.get(identity, controller.signal),
    rejected = assert.rejects(first)
  await entered.promise
  controller.abort()
  await rejected
  assert.equal(abortedSignal!.aborted, true)
  await service.get(identity, signal)
  assert.equal(calls, 2)
})

test('공유 조회 실패 뒤 새 요청을 허용하고 서버 종료는 취소된 작업 정리를 기다린다', async (t) => {
  const entered = gate(),
    finish = gate()
  let calls = 0
  const service = createCharacterDetailService({
    catalog,
    fetchDetails: async () => {
      calls++
      entered.release()
      await finish.promise
      throw new CharacterDetailFailure('unavailable')
    }
  })
  t.after(() => service.onModuleDestroy())
  const first = service.get(identity, signal),
    second = service.get(identity, signal)
  const failures = Promise.all([
    assert.rejects(first, { status: 503 }),
    assert.rejects(second, { status: 503 })
  ])
  await entered.promise
  finish.release()
  await failures
  assert.equal(calls, 1)
  await assert.rejects(service.get(identity, signal), { status: 503 })
  assert.equal(calls, 2)

  const start = gate(),
    cleanup = gate(),
    stopped = new AbortController()
  const shutting = createCharacterDetailService({
    catalog,
    fetchDetails: async (_identity, s) => {
      start.release()
      s.addEventListener('abort', () => stopped.abort(), { once: true })
      await cleanup.promise

      return payloads
    }
  })
  const pending = shutting.get(identity, signal),
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
})

test('상세 응답은 기존 필드에 역할만 정한 card를 더하고 지운 카드 칸은 빈 값이다', async (t) => {
  const service = createCharacterDetailService({ catalog, fetchDetails: async () => payloads })
  t.after(() => service.onModuleDestroy())

  const result = await service.get(identity, signal)

  assert.deepEqual(result.card, {
    role: null,
    stats: null,
    score: null,
    serverRank: null,
    set: null,
    oath: null,
    investment: []
  })
  const { card: _card, ...rest } = result
  assert.deepEqual(
    Object.keys(rest).sort(),
    [
      'avatar',
      'buff',
      'character',
      'creature',
      'equipment',
      'freshness',
      'mistAssimilation',
      'oath',
      'sections',
      'skillStyle',
      'status'
    ].sort()
  )
})
