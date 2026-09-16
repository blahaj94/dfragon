import assert from 'node:assert/strict'
import test from 'node:test'
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
const currentEntry = (key: CatalogKey, expired = false): CatalogEntry => ({
  key,
  payload: { retained: true },
  fetchedAt: new Date(Date.now() - 1000),
  expiresAt: new Date(Date.now() + (expired ? -1 : 60_000))
})

test('abort during the final database clock read rejects before the transaction can commit', async () => {
  const controller = new AbortController()
  let committed = false
  const manager = {
    async query(sql: string) {
      if (sql === 'SELECT clock_timestamp() AS now') {
        controller.abort()
        return [{ now: new Date() }]
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
      [{ key: item, payload: {} }],
      new Date().toISOString(),
      controller.signal
    )
  )
  assert.equal(committed, false)
})
function memoryStore(entries: CatalogEntry[] = []): CatalogStore {
  return {
    async read() {
      return { entries, requestedAt: new Date().toISOString(), now: new Date() }
    },
    async saveAndRead(values) {
      return {
        entries: values.map((value) => ({
          ...value,
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 86_400_000)
        })),
        now: new Date()
      }
    }
  }
}

test('fresh cache avoids upstream and failed refresh keeps stale data or explicit absence', async () => {
  let calls = 0
  const fresh = createCatalogService(memoryStore([currentEntry(item)]), async () => {
    calls++
    throw new Error('unexpected')
  })
  assert.equal((await fresh.load([item, item], signal)).get(catalogKey(item))!.status, 'fresh')
  assert.equal(calls, 0)
  const staleEntry = currentEntry(item, true)
  const fallback = createCatalogService(memoryStore([staleEntry]), async () => {
    throw new Error('upstream secret')
  })
  const result = await fallback.load([item, skill], signal)
  assert.deepEqual(result.get(catalogKey(item)), {
    data: staleEntry.payload,
    fetchedAt: staleEntry.fetchedAt.toISOString(),
    status: 'stale'
  })
  assert.deepEqual(result.get(catalogKey(skill)), {
    data: null,
    fetchedAt: null,
    status: 'unavailable'
  })
  assert(!JSON.stringify([...result]).includes('secret'))
})

test('returns reread committed values and never publishes an unsuccessful DB write', async () => {
  const store = memoryStore()
  store.saveAndRead = async () => ({ entries: [currentEntry(item)], now: new Date() })
  const service = createCatalogService(store, async () => [
    { key: item, payload: { upstream: true } }
  ])
  assert.deepEqual((await service.load([item], signal)).get(catalogKey(item))!.data, {
    retained: true
  })
  store.saveAndRead = async () => {
    throw new Error('commit failed')
  }
  assert.equal((await service.load([item], signal)).get(catalogKey(item))!.data, null)
  store.read = async () => {
    throw new Error('database unavailable')
  }
  assert.equal((await service.load([item], signal)).get(catalogKey(item))!.status, 'unavailable')
})

test('deduplicates, batches at most 15 items, limits concurrency and total reference work', async () => {
  let active = 0,
    peak = 0,
    count = 0
  const service = createCatalogService(memoryStore(), async (keys) => {
    assert(keys.length <= 15)
    active++
    peak = Math.max(active, peak)
    count += keys.length
    await delay(2)
    active--
    return keys.map((key) => ({ key, payload: { fixture: true } }))
  })
  const keys: CatalogKey[] = Array.from({ length: 140 }, (_, i) => ({
    kind: 'item',
    itemId: `item-${i}`
  }))
  const result = await service.load([...keys, keys[0]!], signal)
  assert.equal(count, 128)
  assert(peak <= 3)
  assert.equal(result.get(catalogKey(keys[139]!))!.status, 'unavailable')
})

test('deadline stops queued work; disconnect aborts without persisting late upstream data', async () => {
  let writes = 0,
    calls = 0
  const store = memoryStore()
  store.saveAndRead = async () => {
    writes++
    return { entries: [], now: new Date() }
  }
  const controller = new AbortController()
  const keys: CatalogKey[] = Array.from({ length: 10 }, (_, i) => ({
    kind: 'skill',
    jobId: 'job',
    skillId: `skill-${i}`
  }))
  const service = createCatalogService(
    store,
    async (group, requestSignal) => {
      calls++
      await delay(30, undefined, { signal: requestSignal })
      return group.map((key) => ({ key, payload: {} }))
    },
    5
  )
  const keepAlive = delay(40)
  const result = await service.load(keys, signal)
  assert(calls <= 3)
  assert([...result.values()].every((entry) => entry.status === 'unavailable'))
  assert.equal(writes, 0)
  controller.abort()
  await assert.rejects(service.load(keys, controller.signal))
  await keepAlive
})

test('provider adapter matches item IDs, retains options, and binds skills to the requested job', async () => {
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

test('enrichment preserves 14 slots, enchant skill options, nullable chain and original JSON', async () => {
  const items = Array.from({ length: 14 }, (_, index) => ({
    slotId: index === 13 ? 'SUPPORT_WEAPON' : `SLOT_${index}`,
    itemId: 'fixture-item',
    tune: [{ level: 3 }],
    enchant: {
      status: [{ name: '옵션', value: '3%' }],
      reinforceSkill: [{ jobId: 'other-job', skills: [] }]
    },
    customOption: { future: true }
  }))
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
    return keys.map((key) => ({ key, payload: { tune: [{ level: 0 }] } }))
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
