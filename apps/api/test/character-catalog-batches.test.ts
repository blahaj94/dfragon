import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createNeopleCatalog } from '../src/characters/catalog/neople.js'
import { catalogKey } from '../src/characters/catalog/types.js'
import type { CatalogKey } from '../src/characters/catalog/types.js'

function catalogPayload(key: CatalogKey) {
  return { itemId: key.itemId, itemName: '합성 아이템 ' + key.itemId }
}

test('중복 참조를 한 번씩 조회하고 아이템은 15개 이내로 제공한다', async () => {
  const items: CatalogKey[] = Array.from({ length: 17 }, (_, index) => {
    const itemId = 'item-' + index

    return { kind: 'item', itemId }
  })
  const calls: CatalogKey[][] = []
  const service = createCatalogService(async (keys) => {
    calls.push(keys)

    return keys.map((key) => {
      const payload = catalogPayload(key)

      return { key, payload }
    })
  })
  const before = Date.now()
  const result = await service.load([...items, { ...items[0]! }], new AbortController().signal)

  for (const group of calls) {
    assert(group.length > 0 && group.length <= 15)
  }
  assert.deepEqual(calls.flat().map(catalogKey).sort(), items.map(catalogKey).sort())
  assert.equal(result.size, 17)
  for (const key of items) {
    const fetchedAt = result.get(catalogKey(key))!.detail.fetchedAt
    const fetchedTime = Date.parse(fetchedAt ?? '')
    assert.ok(before <= fetchedTime && fetchedTime <= Date.now(), catalogKey(key))
    assert.deepEqual(result.get(catalogKey(key)), {
      key,
      detail: { data: catalogPayload(key), fetchedAt, status: 'fresh' }
    })
  }
})

test('공급자는 아이템 15개 요청을 받고 16개 요청은 전송 전에 거절한다', async () => {
  let calls = 0
  const adapter = createNeopleCatalog('fixture-key', async (request) => {
    calls++
    const url = new URL(request.url)
    assert.equal(url.pathname, '/df/multi/items')
    const ids = url.searchParams.get('itemIds')
    assert.equal(ids?.split(',').length, 15)

    return Response.json({ rows: [] })
  })
  const keys: CatalogKey[] = Array.from({ length: 16 }, (_, index) => ({
    kind: 'item',
    itemId: 'fixture-' + index
  }))
  assert.deepEqual(await adapter(keys.slice(0, 15), new AbortController().signal), [])
  await assert.rejects(adapter(keys, new AbortController().signal), /Invalid catalog request/)
  assert.equal(calls, 1)
})
