import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createNeopleCatalog } from '../src/characters/catalog/neople.js'

const signal = new AbortController().signal

function catalogPayload(itemId: string) {
  return { itemId, itemName: '합성 아이템 ' + itemId }
}

test('중복 참조를 한 번씩 조회하고 아이템은 15개 이내로 제공한다', async () => {
  const items = Array.from({ length: 17 }, (_, index) => 'item-' + index)
  const calls: string[][] = []
  const service = createCatalogService(async (itemIds) => {
    calls.push(itemIds)

    return new Map(itemIds.map((itemId) => [itemId, catalogPayload(itemId)]))
  })
  const before = Date.now()
  const result = await service.load([...items, items[0]!], new AbortController().signal)

  for (const group of calls) {
    assert(group.length > 0 && group.length <= 15)
  }
  assert.deepEqual(calls.flat().sort(), [...items].sort())
  assert.equal(result.size, 17)
  for (const itemId of items) {
    const fetchedAt = result.get(itemId)!.fetchedAt
    const fetchedTime = Date.parse(fetchedAt ?? '')
    assert.ok(before <= fetchedTime && fetchedTime <= Date.now(), itemId)
    assert.deepEqual(result.get(itemId), {
      data: catalogPayload(itemId),
      fetchedAt,
      status: 'fresh'
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
  const itemIds = Array.from({ length: 16 }, (_, index) => 'fixture-' + index)
  assert.deepEqual(await adapter(itemIds.slice(0, 15), signal), new Map())
  await assert.rejects(adapter(itemIds, signal), /Invalid catalog request/)
  assert.equal(calls, 1)
})
