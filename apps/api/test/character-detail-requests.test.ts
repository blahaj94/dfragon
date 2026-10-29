import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { createCatalogService } from '../src/characters/catalog/service.js'
import {
  type CharacterDetailResponse,
  createCharacterDetailService
} from '../src/characters/details/service.js'
import { CharacterDetailFailure } from '../src/characters/details/errors.js'
import type { NeopleStageTimings } from '../src/characters/details/neople-stages.js'
import type { CharacterPayloads } from '../src/characters/details/sections.js'

const identity = { serverId: 'siroco', characterId: 'refresh-fixture' }
const ignoredTimings: NeopleStageTimings = { record: () => undefined, markShared: () => undefined }
const signal = new AbortController().signal
const catalog = createCatalogService(async () => new Map())
const MINUTE_MS = 60 * 1000
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

interface CharacterDetailJson {
  character: { characterName: string }
  freshness: unknown
  sections: unknown
  card: unknown
}

async function readDetail(pending: Promise<CharacterDetailResponse>): Promise<CharacterDetailJson> {
  const { body } = await pending

  return JSON.parse(body.toString())
}

function payloadsNamed(characterName: string): CharacterPayloads {
  return { ...payloads, basic: { ...common, characterName } }
}

// 호출마다 이름이 바뀌어 응답이 어느 Neople 조회에서 왔는지 구분한다.
function countingNeople() {
  const neople = { calls: 0 }
  const fetchDetails = async () => {
    neople.calls++

    return payloadsNamed(`조회 ${neople.calls}`)
  }

  return { neople, fetchDetails }
}

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

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return { promise, release }
}

test('1시간 안에 다시 조회하면 Neople을 부르지 않고 1시간이 지나면 다시 받는다', async (t) => {
  // lru-cache는 performance.now로 유효 기간을 재므로 가짜 Date 시계를 따르게 한다.
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.parse('2026-10-29T00:00:00Z') })
  t.mock.method(performance, 'now', () => Date.now())
  const { neople, fetchDetails } = countingNeople()
  const service = createCharacterDetailService({ catalog, fetchDetails })
  t.after(() => service.onModuleDestroy())

  const first = await readDetail(service.get(identity, signal, ignoredTimings))
  t.mock.timers.tick(59 * MINUTE_MS)
  const withinHour = await readDetail(service.get(identity, signal, ignoredTimings))
  t.mock.timers.tick(2 * MINUTE_MS)
  const nextHour = await readDetail(service.get(identity, signal, ignoredTimings))

  assert.equal(neople.calls, 2)
  assert.deepEqual(withinHour, first)
  assert.equal(nextHour.character.characterName, '조회 2')
  assert.deepEqual(nextHour.freshness, {
    lastSuccessfulFetchAt: '2026-10-29T01:01:00.000Z',
    expiresAt: '2026-10-29T02:01:00.000Z'
  })
})

test('강제 갱신은 캐시를 건너뛰고 다시 받아 캐시를 덮어쓰며 이후 조회는 새 값을 받는다', async (t) => {
  const { neople, fetchDetails } = countingNeople()
  const service = createCharacterDetailService({ catalog, fetchDetails })
  t.after(() => service.onModuleDestroy())

  const cached = await readDetail(service.get(identity, signal, ignoredTimings))
  const refreshed = await readDetail(service.refresh(identity, signal, ignoredTimings))
  const afterRefresh = await readDetail(service.get(identity, signal, ignoredTimings))

  assert.equal(cached.character.characterName, '조회 1')
  assert.equal(refreshed.character.characterName, '조회 2')
  assert.deepEqual(afterRefresh, refreshed)
  assert.equal(neople.calls, 2)
})

test('강제 갱신이 실패하면 상세 조회와 같은 오류를 돌려주고 기존 캐시는 그대로 둔다', async (t) => {
  let calls = 0
  const service = createCharacterDetailService({
    catalog,
    fetchDetails: async () => {
      calls++
      if (calls === 2) {
        throw new CharacterDetailFailure('unavailable')
      }

      return payloadsNamed(`조회 ${calls}`)
    }
  })
  t.after(() => service.onModuleDestroy())

  const cached = await readDetail(service.get(identity, signal, ignoredTimings))
  await assert.rejects(service.refresh(identity, signal, ignoredTimings), {
    status: 503,
    body: new CharacterDetailFailure('unavailable').body
  })
  const afterFailure = await readDetail(service.get(identity, signal, ignoredTimings))

  assert.deepEqual(afterFailure, cached)
  assert.equal(calls, 2)
})

test('연결을 끊고 떠난 강제 갱신의 조회가 나중에 끝나도 기존 캐시를 덮어쓰지 않는다', async (t) => {
  let calls = 0
  const late = gate()
  // 공급자가 취소 신호를 무시하고 요청이 떠난 뒤에 성공하는 경우다.
  const service = createCharacterDetailService({
    catalog,
    fetchDetails: async () => {
      calls++
      if (calls === 2) {
        await late.promise
      }

      return payloadsNamed(`조회 ${calls}`)
    }
  })
  t.after(() => service.onModuleDestroy())

  const cached = await readDetail(service.get(identity, signal, ignoredTimings))
  const leaving = new AbortController()
  const abandoned = service.refresh(identity, leaving.signal, ignoredTimings)
  await nextTurn()
  leaving.abort()
  await assert.rejects(abandoned)
  late.release()
  await nextTurn()
  const afterAbandon = await readDetail(service.get(identity, signal, ignoredTimings))

  assert.deepEqual(afterAbandon, cached)
  assert.equal(calls, 2)
})

test('같은 캐릭터를 받는 중이면 강제 갱신은 새로 부르지 않고 그 조회를 함께 기다린다', async (t) => {
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
  const joiner = collectTimings()

  const fetching = service.get(identity, signal, ignoredTimings)
  await entered.promise
  const refreshing = service.refresh(identity, signal, joiner.timings)
  finish.release()
  const [fetched, refreshed] = await Promise.all([fetching, refreshing])

  assert.equal(calls, 1)
  assert.deepEqual(refreshed, fetched)
  assert.equal(joiner.isShared(), true)
})

test('캐시가 맞은 요청은 저장한 응답 본문을 다시 쓰며 Neople, 공용 아이템 시간 없이 공유로 표시하지 않는다', async (t) => {
  const service = createCharacterDetailService({
    catalog,
    fetchDetails: async (_identity, _signal, recordStage) => {
      recordStage('basic', 12)
      recordStage('sections', 34)

      return payloads
    }
  })
  t.after(() => service.onModuleDestroy())
  const miss = collectTimings(),
    hit = collectTimings()

  const built = await service.get(identity, signal, miss.timings)
  const reused = await service.get(identity, signal, hit.timings)

  assert.deepEqual(Object.keys(miss.stages).sort(), ['basic', 'catalog', 'sections'])
  assert.equal(built.reused, false)
  assert.deepEqual(hit.stages, {})
  assert.equal(reused.reused, true)
  assert.deepEqual(reused.body, built.body)
  assert.equal(hit.isShared(), false)
})

test('상세 응답 JSON은 섹션마다 revision 1과 조회 시각을, freshness에 조회 시각과 1시간 뒤 만료를 담는다', async (t) => {
  const fetchedAt = '2026-10-29T00:00:00.000Z'
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(fetchedAt) })
  const service = createCharacterDetailService({ catalog, fetchDetails: async () => payloads })
  t.after(() => service.onModuleDestroy())

  const result = await readDetail(service.get(identity, signal, ignoredTimings))

  const metadata = { revision: 1, contentUpdatedAt: fetchedAt, lastSuccessfulFetchAt: fetchedAt }
  assert.deepEqual(result, {
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
    freshness: { lastSuccessfulFetchAt: fetchedAt, expiresAt: '2026-10-29T01:00:00.000Z' },
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
  const first = service.get(identity, disconnected.signal, ignoredTimings)
  const rejection = assert.rejects(first)
  await entered.promise
  const second = service.get(identity, signal, ignoredTimings)
  second.catch(() => undefined)
  await nextTurn()
  disconnected.abort()
  await rejection
  assert.equal(sharedSignal!.aborted, false)
  finish.release()
  assert.equal((await readDetail(second)).character.characterName, '합성 캐릭터')
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
    const first = service.get(identity, signal, ignoredTimings)
    await entered.promise
    const second = service.get(identity, signal, ignoredTimings)
    await nextTurn()
    finish.release()
    const [a, b] = await Promise.all([readDetail(first), readDetail(second)])

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
      recordStage('basic', 12)
      basicDone.release()
      await finish.promise
      recordStage('sections', 34)

      return payloads
    }
  })
  t.after(async () => {
    finish.release()
    await service.onModuleDestroy()
  })
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
    first = service.get(identity, controller.signal, ignoredTimings),
    rejected = assert.rejects(first)
  await entered.promise
  controller.abort()
  await rejected
  assert.equal(abortedSignal!.aborted, true)
  await service.get(identity, signal, ignoredTimings)
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
  const first = service.get(identity, signal, ignoredTimings),
    second = service.get(identity, signal, ignoredTimings)
  const failures = Promise.all([
    assert.rejects(first, { status: 503 }),
    assert.rejects(second, { status: 503 })
  ])
  await entered.promise
  finish.release()
  await failures
  assert.equal(calls, 1)
  await assert.rejects(service.get(identity, signal, ignoredTimings), { status: 503 })
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
  const pending = shutting.get(identity, signal, ignoredTimings),
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

test('서버 종료는 진행 중인 공용 아이템 묶음 호출을 취소하고 정리를 기다린다', async () => {
  const started = gate(),
    cleanup = gate(),
    stopped = new AbortController()
  const service = createCharacterDetailService({
    catalog: createCatalogService(async (_itemIds, batchSignal) => {
      started.release()
      batchSignal.addEventListener('abort', () => stopped.abort(), { once: true })
      await cleanup.promise

      return new Map()
    }),
    fetchDetails: async () => ({
      ...payloads,
      equipment: { ...common, equipment: [{ itemId: 'fixture-item' }], setItemInfo: [] }
    })
  })
  const pending = service.get(identity, signal, ignoredTimings),
    rejected = assert.rejects(pending)
  await started.promise
  let closed = false
  const closing = service.onModuleDestroy().then(() => {
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

  const result = await readDetail(service.get(identity, signal, ignoredTimings))

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
