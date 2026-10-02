import assert from 'node:assert/strict'
import test from 'node:test'
import { NeopleBudget } from '../src/characters/provider-budget.js'
import { setTimeout as delay } from 'node:timers/promises'
import { createNeopleCatalog } from '../src/characters/catalog/neople.js'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { enrichCharacterDetails } from '../src/characters/catalog/enrich.js'
import type { CatalogStore } from '../src/characters/catalog/store.js'
import { createCatalogStore } from '../src/characters/catalog/store.js'
import type { DataSource, EntityManager } from 'typeorm'
import { catalogKey } from '../src/characters/catalog/types.js'
import type { CatalogEntry, CatalogKey } from '../src/characters/catalog/types.js'
import type { projectCharacterDetails } from '../src/characters/details/project.js'

const signal = new AbortController().signal
const item: CatalogKey = { kind: 'item', itemId: 'fixture-item' }
const skill: CatalogKey = { kind: 'skill', jobId: 'fixture-job', skillId: 'fixture-skill' }
const catalogTime = Date.parse('2026-09-01T00:00:00.000Z')
function catalogPayload(key: CatalogKey) {
  if (key.kind === 'item') {
    const itemId = key.itemId
    const itemName = '합성 아이템 ' + itemId

    return { itemId, itemName }
  }

  if (key.kind === 'set') {
    const setItemId = key.setItemId
    const setItemName = '합성 세트 ' + setItemId

    return { setItemId, setItemName, setItemOption: [] }
  }
  const jobId = key.jobId
  const name = '합성 스킬 ' + key.skillId

  return { jobId, name, levelInfo: { rows: [] } }
}
const currentEntry = (key: CatalogKey, expired = false): CatalogEntry => {
  const fetchedAt = new Date(catalogTime - (expired ? 86_400_001 : 1000))
  const expiresAt = new Date(fetchedAt.getTime() + 86_400_000)
  const payload = { ...catalogPayload(key), retained: true }

  return { key, payload, fetchedAt, expiresAt }
}

test('마지막 DB 시각 조회 직후 취소되면 저장 transaction 콜백의 성공 반환을 막는다', async () => {
  const controller = new AbortController()
  let committed = false
  const manager = {
    async query(sql: string) {
      if (sql === 'SELECT clock_timestamp() AS now') {
        controller.abort()
        const now = new Date(catalogTime)

        return [{ now }]
      }

      return []
    },
    getRepository() {
      return { findBy: async () => [] }
    }
  } as unknown as EntityManager
  const source = {
    async transaction(_isolation: string, callback: (manager: EntityManager) => Promise<unknown>) {
      const result = await callback(manager)
      committed = true

      return result
    }
  } as unknown as DataSource
  await assert.rejects(
    createCatalogStore(source).saveAndRead(
      [{ key: item, payload: catalogPayload(item) }],
      new Date().toISOString(),
      controller.signal
    ),
    { name: 'AbortError' }
  )
  assert.equal(committed, false)
})
function memoryStore(entries: CatalogEntry[] = [], time = catalogTime): CatalogStore {
  const stored = new Map(entries.map((entry) => [catalogKey(entry.key), structuredClone(entry)]))

  return {
    async read(keys, requestSignal) {
      requestSignal.throwIfAborted()
      const entries = keys.flatMap((key) => {
        const entry = stored.get(catalogKey(key))
        if (!entry) {
          return []
        }

        return [structuredClone(entry)]
      })
      const requestedAt = new Date(time).toISOString()
      const now = new Date(time)

      return { entries, requestedAt, now }
    },
    async saveAndRead(values, _requestedAt, requestSignal) {
      requestSignal.throwIfAborted()
      const savedEntries = values.map((value) => {
        const snapshot = structuredClone(value)
        const fetchedAt = new Date(time)
        const expiresAt = new Date(time + 86_400_000)

        return { ...snapshot, fetchedAt, expiresAt }
      })
      for (const entry of savedEntries) {
        stored.set(catalogKey(entry.key), entry)
      }
      const now = new Date(time)

      return { entries: structuredClone(savedEntries), now }
    }
  }
}

test('유효한 캐시는 upstream 없이 반환하고 갱신 실패는 stale 저장값과 unavailable을 구분한다', async () => {
  let calls = 0
  const fresh = createCatalogService(memoryStore([currentEntry(item)]), async () => {
    calls++
    throw new Error('unexpected')
  })
  assert.equal(
    (await fresh.load([item, item], signal)).get(catalogKey(item))!.detail.status,
    'fresh'
  )
  assert.equal(calls, 0)
  const staleEntry = currentEntry(item, true)
  const fallback = createCatalogService(memoryStore([staleEntry]), async () => {
    throw new Error('upstream secret')
  })
  const result = await fallback.load([item, skill], signal)
  assert.deepEqual(result.get(catalogKey(item))!.detail, {
    data: staleEntry.payload,
    fetchedAt: staleEntry.fetchedAt.toISOString(),
    status: 'stale'
  })
  assert.deepEqual(result.get(catalogKey(skill))!.detail, {
    data: null,
    fetchedAt: null,
    status: 'unavailable'
  })
  assert(!JSON.stringify([...result]).includes('secret'))
})

test('DB가 재조회한 저장값만 제공하고 저장·읽기 실패의 upstream 원문은 성공값으로 쓰지 않는다', async () => {
  const store = memoryStore()
  store.saveAndRead = async () => {
    const entries = [currentEntry(item)]
    const now = new Date(catalogTime)

    return { entries, now }
  }
  const service = createCatalogService(store, async () => [
    { key: item, payload: { ...catalogPayload(item), upstream: true } }
  ])
  assert.deepEqual((await service.load([item], signal)).get(catalogKey(item))!.detail, {
    data: currentEntry(item).payload,
    fetchedAt: '2026-08-31T23:59:59.000Z',
    status: 'fresh'
  })
  store.saveAndRead = async () => {
    throw new Error('commit failed')
  }
  assert.deepEqual((await service.load([item], signal)).get(catalogKey(item))!.detail, {
    data: null,
    fetchedAt: null,
    status: 'unavailable'
  })
  store.read = async () => {
    throw new Error('database unavailable')
  }
  assert.equal(
    (await service.load([item], signal)).get(catalogKey(item))!.detail.status,
    'unavailable'
  )
})

test('중복을 제거한 128개까지만 조회하고 15개 배치와 동시 3개 호출 한도를 지킨다', async () => {
  let active = 0,
    peak = 0,
    count = 0
  const service = createCatalogService(memoryStore(), async (keys) => {
    assert(keys.length <= 15)
    active++
    peak = Math.max(active, peak)
    count += keys.length
    await Promise.resolve()
    active--

    return keys.map((key) => {
      const payload = catalogPayload(key)

      return { key, payload }
    })
  })
  const keys: CatalogKey[] = Array.from({ length: 140 }, (_, i) => {
    const itemId = `item-${i}`

    return { kind: 'item', itemId }
  })
  const result = await service.load([...keys, keys[0]!], signal)
  assert.equal(count, 128)
  assert(peak > 0 && peak <= 3)
  assert.equal(result.size, 140)
  for (const [index, key] of keys.entries()) {
    const expectedData = index < 128 ? catalogPayload(key) : null
    const expectedFetchedAt = index < 128 ? '2026-09-01T00:00:00.000Z' : null
    const expectedStatus = index < 128 ? 'fresh' : 'unavailable'
    assert.deepEqual(result.get(catalogKey(key))!.detail, {
      data: expectedData,
      fetchedAt: expectedFetchedAt,
      status: expectedStatus
    })
  }
})

test('처리 기한이 끝나면 대기 중인 스킬 조회를 시작하지 않고 취소된 요청은 전송하지 않는다', async () => {
  let writes = 0,
    calls = 0
  const store = memoryStore()
  store.saveAndRead = async () => {
    writes++
    const now = new Date(catalogTime)

    return { entries: [], now }
  }
  const controller = new AbortController()
  const keys: CatalogKey[] = Array.from({ length: 10 }, (_, i) => {
    const skillId = `skill-${i}`

    return { kind: 'skill', jobId: 'job', skillId }
  })
  const service = createCatalogService(
    store,
    async (group, requestSignal) => {
      calls++
      await delay(30, undefined, { signal: requestSignal })

      return group.map((key) => {
        const payload = catalogPayload(key)

        return { key, payload }
      })
    },
    5
  )
  const result = await service.load(keys, signal)
  assert(calls > 0 && calls <= 3)
  const started = calls
  for (const entry of result.values()) {
    assert.deepEqual(entry.detail, { data: null, fetchedAt: null, status: 'unavailable' })
  }
  assert.equal(writes, 0)
  controller.abort()
  await assert.rejects(service.load(keys, controller.signal))
  assert.equal(calls, started)
})

test('공급자 응답을 요청 itemId·jobId로 대응하고 옵션을 보존하며 오류 원문을 정제한다', async () => {
  const requestPaths: string[] = []
  const fetchImpl: typeof fetch = async (url, options) => {
    requestPaths.push(String(url))
    assert.equal(options?.redirect, 'error')
    assert.equal((options?.headers as Record<string, string>).apikey, 'fixture-key')

    return Response.json({
      rows: [
        { itemId: 'other-item', itemName: '다른 장비' },
        { itemId: 'fixture-item', itemName: '장비', option: { value: '3%' } }
      ]
    })
  }
  const values = await createNeopleCatalog('fixture-key', fetchImpl)(
    [item, { kind: 'item', itemId: 'missing' }],
    signal
  )
  assert.equal(values.length, 1)
  assert.deepEqual(values[0]!.payload.option, { value: '3%' })
  assert(!requestPaths[0]!.includes('fixture-key'))
  const skillAdapter = createNeopleCatalog('fixture-key', async (url) => {
    assert(String(url).endsWith('/skills/fixture-job/fixture-skill'))

    return Response.json({ jobId: 'fixture-job', name: '스킬', levelInfo: { rows: [] } })
  })
  assert.deepEqual((await skillAdapter([skill], signal))[0]!.key, skill)
  const wrongJob = createNeopleCatalog('fixture-key', async () =>
    Response.json({ jobId: 'other-job', name: '스킬' })
  )
  await assert.rejects(wrongJob([skill], signal), { message: 'Catalog lookup failed' })
  const failure = createNeopleCatalog('fixture-key', async () => {
    throw new Error('secret upstream message')
  })
  await assert.rejects(failure([item], signal), { message: 'Catalog lookup failed' })
})

test('14개 장비 슬롯·마법부여 스킬 옵션·체인 null과 캐릭터 원본을 보존한다', async () => {
  const items = Array.from({ length: 14 }, (_, index) => {
    const slotId = index === 13 ? 'SUPPORT_WEAPON' : `SLOT_${index}`

    return {
      slotId,
      itemId: 'fixture-item',
      tune: [{ level: 3 }],
      enchant: {
        status: [{ name: '옵션', value: '3%' }],
        reinforceSkill: [{ jobId: 'other-job', skills: [] }]
      },
      customOption: { future: true }
    }
  })
  const details: ReturnType<typeof projectCharacterDetails> = {
    character: { jobId: 'fixture-job' },
    status: { status: [], buff: [] },
    equipment: { equipment: items, setItemInfo: [{}, {}, {}] },
    avatar: null,
    creature: null,
    oath: null,
    mistAssimilation: null,
    skillStyle: {
      hash: 'opaque',
      style: {
        passive: [{ skillId: 'fixture-skill', level: 1 }],
        evolution: [{ skillId: 'fixture-skill', type: 1 }],
        chain: { resetTime: 0, skills: [null, 'fixture-skill', null, null] }
      }
    },
    buff: { equipment: { equipment: [items[0]] }, avatar: null, creature: null },
    sections: {}
  }
  const original = structuredClone(details)
  let requested = 0
  const service = createCatalogService(memoryStore(), async (keys) => {
    requested += keys.length

    return keys.map((key) => {
      const payload = { ...catalogPayload(key), tune: [{ level: 0 }] }

      return { key, payload }
    })
  })
  const result = await enrichCharacterDetails(details, service, signal)
  assert.equal(requested, 2)
  assert.deepEqual(details, original)
  const resultItems = result.equipment.equipment as Array<Record<string, unknown>>
  assert.equal(resultItems.length, 14)
  assert.deepEqual(resultItems[0]!.tune, [{ level: 3 }])
  assert.deepEqual(resultItems[0]!.enchant, items[0]!.enchant)
  assert.deepEqual(
    (result.skillStyle as Record<string, unknown>).style,
    (original.skillStyle as Record<string, unknown>).style
  )
  assert.equal(
    (result.skillStyle as { skillDetails: Record<string, { status: string }> }).skillDetails[
      'fixture-skill'
    ]!.status,
    'fresh'
  )
})

test('연결 종료 뒤 늦은 성공은 저장하지 않고 연결된 요청의 성공만 저장한다', async () => {
  for (const disconnected of [false, true]) {
    const controller = new AbortController()
    let markStarted!: () => void
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    let finishFetch!: () => void
    const release = new Promise<void>((resolve) => {
      finishFetch = resolve
    })
    const store = memoryStore()
    const save = store.saveAndRead
    let writes = 0
    store.saveAndRead = async (...args) => {
      writes++

      return save(...args)
    }
    const service = createCatalogService(store, async (keys, requestSignal) => {
      markStarted()
      await release
      assert.equal(requestSignal.aborted, disconnected)

      return keys.map((key) => {
        const payload = { ...catalogPayload(key), late: true }

        return { key, payload }
      })
    })
    const pending = service.load([item], controller.signal)
    await started
    if (disconnected) {
      controller.abort()
    }
    finishFetch()
    if (disconnected) {
      await assert.rejects(pending, { name: 'AbortError' })
      assert.equal(writes, 0)
    } else {
      const result = await pending
      assert.equal(writes, 1)
      assert.deepEqual(result.get(catalogKey(item))!.detail.data, {
        itemId: 'fixture-item',
        itemName: '합성 아이템 fixture-item',
        late: true
      })
    }
  }
})

test('이미 취소된 공용 상세 요청은 전송과 공급자 호출 예산을 소비하지 않는다', async () => {
  const budget = new NeopleBudget(() => 0)
  for (let count = 0; count < 599; count++) {
    await budget.run(async () => undefined)
  }
  let calls = 0
  const adapter = createNeopleCatalog(
    'fixture-key',
    async () => {
      calls++

      return Response.json({ rows: [] })
    },
    budget
  )
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(adapter([item], controller.signal), { message: 'Catalog lookup failed' })
  assert.equal(calls, 0)
  assert.equal(await budget.run(async () => '정상 transport'), '정상 transport')
  await assert.rejects(
    budget.run(async () => '예산 초과 transport'),
    { status: 429 }
  )
})

test('공용 상세는 DB 시각으로 정확히 24시간에 만료되고 성공 갱신 후 새 조회 시각을 반환한다', async (t) => {
  for (const [name, elapsed, refreshes] of [
    ['24시간 만료 1ms 전', 86_399_999, 0],
    ['정확히 24시간 만료', 86_400_000, 1],
    ['24시간 만료 1ms 후', 86_400_001, 1]
  ] as const) {
    await t.test(name, async () => {
      const entry: CatalogEntry = {
        key: item,
        payload: { itemId: 'fixture-item', itemName: '이전 아이템', itemExplain: '기존 옵션' },
        fetchedAt: new Date('2026-09-01T00:00:00.000Z'),
        expiresAt: new Date('2026-09-02T00:00:00.000Z')
      }
      const incoming = { itemId: 'fixture-item', itemName: '최신 아이템', itemExplain: '갱신 옵션' }
      const before = structuredClone(entry)
      const now = catalogTime + elapsed
      let calls = 0
      const service = createCatalogService(memoryStore([entry], now), async (keys) => {
        calls++
        assert.deepEqual(keys, [item])

        return [{ key: item, payload: incoming }]
      })

      const result = await service.load([item], signal)

      assert.equal(calls, refreshes)
      const expectedData = refreshes === 0 ? entry.payload : incoming
      const expectedFetchedAt =
        refreshes === 0 ? '2026-09-01T00:00:00.000Z' : new Date(now).toISOString()
      assert.deepEqual(result.get(catalogKey(item))!.detail, {
        data: expectedData,
        fetchedAt: expectedFetchedAt,
        status: 'fresh'
      })
      assert.deepEqual(entry, before)
    })
  }
})

test('아이템 다중 응답의 누락·중복·잘못된 이름은 저장 대상에서 제외하고 올바른 이웃만 유지한다', async () => {
  const wanted: CatalogKey[] = [
    { kind: 'item', itemId: 'valid' },
    { kind: 'item', itemId: 'duplicate' },
    { kind: 'item', itemId: 'missing' },
    { kind: 'item', itemId: 'bad-name' }
  ]
  const valid = {
    itemId: 'valid',
    itemName: '정상 아이템',
    itemStatus: [{ name: '힘', value: 0 }],
    futureOption: { rate: '3%' }
  }
  const adapter = createNeopleCatalog('fixture-key', async () =>
    Response.json({
      rows: [
        { itemId: 'unrequested', itemName: '요청하지 않은 아이템' },
        { itemId: 'duplicate', itemName: '중복 아이템' },
        valid,
        { itemId: 'duplicate', itemName: '중복 아이템' },
        { itemId: 'bad-name', itemName: null },
        null,
        []
      ]
    })
  )

  assert.deepEqual(await adapter(wanted, signal), [{ key: wanted[0], payload: valid }])
})

test('스킬 응답에서 제공된 skillId가 다르거나 직업·이름 envelope가 없으면 정제 오류로 거절한다', async (t) => {
  for (const [name, body] of [
    ['다른 skillId', { jobId: 'fixture-job', skillId: 'different-skill', name: '스킬' }],
    ['누락 jobId', { name: '스킬' }],
    ['빈 이름', { jobId: 'fixture-job', name: ' ' }],
    ['오류 envelope', { error: { code: 'API901', message: 'private upstream detail' } }]
  ] as const) {
    await t.test(name, async () => {
      const adapter = createNeopleCatalog('fixture-key', async () => Response.json(body))
      await assert.rejects(adapter([skill], signal), { message: 'Catalog lookup failed' })
    })
  }
})
