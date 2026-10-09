import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createNeopleCatalog } from '../src/characters/catalog/neople.js'
import { catalogKey } from '../src/characters/catalog/types.js'
import type { CatalogStore } from '../src/characters/catalog/store.js'
import type { CatalogKey } from '../src/characters/catalog/types.js'

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

test('중복 참조를 한 번씩 조회하고 아이템, 세트는 15개 이내, 스킬은 단독 요청으로 제공한다', async () => {
  const items: CatalogKey[] = Array.from({ length: 17 }, (_, index) => {
    const itemId = 'item-' + index

    return { kind: 'item', itemId }
  })
  const sets: CatalogKey[] = Array.from({ length: 16 }, (_, index) => {
    const setItemId = 'set-' + index

    return { kind: 'set', setItemId }
  })
  const skills: CatalogKey[] = [
    { kind: 'skill', jobId: 'job', skillId: 'skill-a' },
    { kind: 'skill', jobId: 'job', skillId: 'skill-b' }
  ]
  const now = new Date('2026-09-01T00:00:00.000Z')
  const requestedAt = now.toISOString()
  const store: CatalogStore = {
    read: async () => ({ entries: [], now, requestedAt }),
    saveAndRead: async (values) => {
      const entries = values.map((value) => ({
        ...value,
        fetchedAt: now,
        expiresAt: new Date('2026-09-02T00:00:00.000Z')
      }))

      return { entries, now }
    }
  }
  const calls: CatalogKey[][] = []
  const service = createCatalogService(store, async (keys) => {
    calls.push(keys)

    return keys.map((key) => {
      const payload = catalogPayload(key)

      return { key, payload }
    })
  })
  const unique = [...items, ...sets, ...skills]
  const result = await service.load(
    [skills[0]!, sets[0]!, ...items, ...sets.slice(1), skills[1]!, { ...items[0]! }],
    new AbortController().signal
  )

  for (const group of calls) {
    assert(group.length > 0 && group.length <= 15)
    assert(group.every((key) => key.kind === group[0]!.kind))
    if (group[0]!.kind === 'skill') {
      assert.equal(group.length, 1)
    }
  }
  assert.deepEqual(calls.flat().map(catalogKey).sort(), unique.map(catalogKey).sort())
  assert.equal(result.size, 35)
  for (const key of unique) {
    assert.deepEqual(result.get(catalogKey(key)), {
      key,
      detail: {
        data: catalogPayload(key),
        fetchedAt: '2026-09-01T00:00:00.000Z',
        status: 'fresh'
      }
    })
  }
})

test('공급자는 아이템, 세트 15개 요청을 받고 16개 요청은 전송 전에 거절한다', async () => {
  let calls = 0
  const adapter = createNeopleCatalog('fixture-key', async (input) => {
    calls++
    const url = new URL(String(input))
    const ids = url.searchParams.get('itemIds') ?? url.searchParams.get('setItemIds')
    assert.equal(ids?.split(',').length, 15)

    return Response.json({ rows: [] })
  })
  for (const kind of ['item', 'set'] as const) {
    const keys: CatalogKey[] = Array.from({ length: 16 }, (_, index) => {
      const id = 'fixture-' + index
      if (kind === 'item') {
        return { kind, itemId: id }
      }

      return { kind, setItemId: id }
    })
    assert.deepEqual(await adapter(keys.slice(0, 15), new AbortController().signal), [])
    await assert.rejects(adapter(keys, new AbortController().signal), /Invalid catalog request/)
  }
  assert.equal(calls, 2)
})
