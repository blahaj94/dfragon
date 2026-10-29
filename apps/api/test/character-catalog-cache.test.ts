import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogService } from '../src/characters/catalog/service.js'

const signal = new AbortController().signal
const HOUR_MS = 60 * 60 * 1000

function catalogPayload(itemId: string) {
  return { itemId, itemName: '합성 아이템 ' + itemId }
}

function recordingCatalog() {
  const calls: string[][] = []
  const service = createCatalogService(async (itemIds) => {
    calls.push(itemIds)

    return new Map(itemIds.map((itemId) => [itemId, catalogPayload(itemId)]))
  })

  return { calls, service }
}

test('같은 아이템을 다시 조회하면 공급자를 부르지 않고 처음 받은 시각을 그대로 준다', async () => {
  const { calls, service } = recordingCatalog()
  const first = await service.load(['item-a'], signal)
  const second = await service.load(['item-a'], signal)

  assert.deepEqual(calls, [['item-a']])
  assert.deepEqual(second.get('item-a'), first.get('item-a'))
  assert.equal(second.get('item-a')!.status, 'fresh')
})

test('동시에 들어온 두 요청의 아이템을 중복 없이 한 번의 묶음 호출로 조회한다', async () => {
  const { calls, service } = recordingCatalog()
  const [left, right] = await Promise.all([
    service.load(['item-a', 'item-b'], signal),
    service.load(['item-b', 'item-c'], signal)
  ])

  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0]!.toSorted(), ['item-a', 'item-b', 'item-c'])
  assert.deepEqual(left.get('item-b'), right.get('item-b'))
  for (const result of [left, right]) {
    for (const detail of result.values()) {
      assert.equal(detail.status, 'fresh')
    }
  }
})

test('조회에 실패했거나 응답에 없던 아이템은 저장하지 않고 다음 요청이 다시 조회한다', async () => {
  const calls: string[][] = []
  let failing = true
  const service = createCatalogService(async (itemIds) => {
    calls.push(itemIds)
    if (failing) {
      throw new Error('failure')
    }

    return new Map([['item-a', catalogPayload('item-a')]])
  })

  const failed = await service.load(['item-a'], signal)
  failing = false
  const missing = await service.load(['item-a', 'item-b'], signal)
  const retried = await service.load(['item-a', 'item-b'], signal)

  assert.equal(failed.get('item-a')!.status, 'unavailable')
  assert.equal(missing.get('item-a')!.status, 'fresh')
  for (const result of [missing, retried]) {
    assert.deepEqual(result.get('item-b'), { data: null, fetchedAt: null, status: 'unavailable' })
  }
  assert.deepEqual(
    calls.map((itemIds) => itemIds.toSorted()),
    [['item-a'], ['item-a', 'item-b'], ['item-b']]
  )
})

test('하루 안에는 저장한 값을 쓰고 하루가 지나면 다시 조회해 새 시각을 준다', async (t) => {
  // lru-cache는 performance.now로 유효 기간을 재므로 가짜 Date 시계를 따르게 한다.
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.parse('2026-10-29T00:00:00Z') })
  t.mock.method(performance, 'now', () => Date.now())
  const { calls, service } = recordingCatalog()

  const first = await service.load(['item-a'], signal)
  t.mock.timers.tick(23 * HOUR_MS)
  const withinDay = await service.load(['item-a'], signal)
  t.mock.timers.tick(2 * HOUR_MS)
  const nextDay = await service.load(['item-a'], signal)

  assert.equal(calls.length, 2)
  assert.deepEqual(withinDay.get('item-a'), first.get('item-a'))
  assert.equal(nextDay.get('item-a')!.status, 'fresh')
  assert.equal(nextDay.get('item-a')!.fetchedAt, '2026-10-30T01:00:00.000Z')
})

test('한 요청이 취소돼도 함께 기다리던 요청은 결과를 받고 공유 조회는 저장된다', async () => {
  const calls: string[][] = []
  let markStarted!: () => void
  const started = new Promise<void>((resolve) => {
    markStarted = resolve
  })
  let release!: () => void
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  const service = createCatalogService(async (itemIds) => {
    calls.push(itemIds)
    markStarted()
    await released

    return new Map(itemIds.map((itemId) => [itemId, catalogPayload(itemId)]))
  })
  const canceled = new AbortController()

  const abandoned = service.load(['item-a'], canceled.signal)
  const waiting = service.load(['item-a'], signal)
  await started
  canceled.abort()
  await assert.rejects(abandoned, { name: 'AbortError' })
  release()
  const result = await waiting
  const cached = await service.load(['item-a'], signal)

  assert.deepEqual(result.get('item-a')!.data, catalogPayload('item-a'))
  assert.deepEqual(cached.get('item-a'), result.get('item-a'))
  assert.deepEqual(calls, [['item-a']])
})
