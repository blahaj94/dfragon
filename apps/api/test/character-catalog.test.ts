import assert from 'node:assert/strict'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { createNeopleCatalog } from '../src/characters/catalog/neople.js'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { enrichCharacterDetails } from '../src/characters/catalog/enrich.js'
import { catalogKey } from '../src/characters/catalog/types.js'
import type { CatalogKey } from '../src/characters/catalog/types.js'
import type { projectCharacterDetails } from '../src/characters/details/project.js'

const signal = new AbortController().signal
const item: CatalogKey = { kind: 'item', itemId: 'fixture-item' }
function catalogPayload(key: CatalogKey) {
  return { itemId: key.itemId, itemName: '합성 아이템 ' + key.itemId }
}
test('중복을 제거한 128개까지만 조회하고 15개 이하 배치 9개를 모두 동시에 시작한다', async () => {
  let active = 0,
    peak = 0,
    count = 0
  const service = createCatalogService(async (keys) => {
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
  // 예전 동시 3 batch 제한에서는 peak가 3이었다.
  assert.equal(peak, 9)
  assert.equal(result.size, 140)
  for (const [index, key] of keys.entries()) {
    const expectedData = index < 128 ? catalogPayload(key) : null
    const expectedStatus = index < 128 ? 'fresh' : 'unavailable'
    const detail = result.get(catalogKey(key))!.detail
    assert.deepEqual(detail.data, expectedData)
    assert.equal(detail.status, expectedStatus)
    assert.equal(detail.fetchedAt === null, index >= 128)
  }
})

test('처리 기한이 끝나면 진행 중인 아이템 조회를 쓰지 않고 취소된 요청은 전송하지 않는다', async () => {
  let calls = 0
  const controller = new AbortController()
  const keys: CatalogKey[] = Array.from({ length: 10 }, (_, i) => {
    const itemId = `item-${i}`

    return { kind: 'item', itemId }
  })
  const service = createCatalogService(async (group, requestSignal) => {
    calls++
    await delay(30, undefined, { signal: requestSignal })

    return group.map((key) => {
      const payload = catalogPayload(key)

      return { key, payload }
    })
  }, 5)
  const result = await service.load(keys, signal)
  assert.equal(calls, 1)
  const started = calls
  for (const entry of result.values()) {
    assert.deepEqual(entry.detail, { data: null, fetchedAt: null, status: 'unavailable' })
  }
  controller.abort()
  await assert.rejects(service.load(keys, controller.signal))
  assert.equal(calls, started)
})

test('공급자 응답을 요청 itemId로 대응하고 옵션을 보존하며 오류 원문을 정제한다', async () => {
  const requestPaths: string[] = []
  const fetchImpl = async (request: Request) => {
    requestPaths.push(request.url)
    assert.equal(request.redirect, 'error')
    assert.equal(request.headers.get('apikey'), 'fixture-key')

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
  const failure = createNeopleCatalog('fixture-key', async () => {
    throw new Error('secret upstream message')
  })
  await assert.rejects(failure([item], signal), { message: 'Catalog lookup failed' })
  let unavailableCalls = 0
  const unavailable = createNeopleCatalog('fixture-key', async () => {
    unavailableCalls++

    return Response.json({ error: { message: 'secret upstream message' } }, { status: 503 })
  })
  await assert.rejects(unavailable([item], signal), { message: 'Catalog lookup failed' })
  // 503은 HTTP client 기본 재시도 대상이지만 공용 상세 조회는 재시도하지 않는다.
  assert.equal(unavailableCalls, 1)
  const service = createCatalogService(async () => {
    throw new Error('secret upstream message')
  })
  const result = await service.load([item], signal)
  assert.equal(result.get(catalogKey(item))!.detail.status, 'unavailable')
  assert.equal(JSON.stringify([...result]).includes('secret'), false)
})

test('14개 장비 슬롯, 마법부여 스킬 옵션, 체인 null과 캐릭터 원본을 보존한다', async () => {
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
  const service = createCatalogService(async (keys) => {
    requested += keys.length

    return keys.map((key) => {
      const payload = { ...catalogPayload(key), tune: [{ level: 0 }] }

      return { key, payload }
    })
  })
  const result = await enrichCharacterDetails(details, service, signal)
  assert.equal(requested, 1)
  assert.deepEqual(details, original)
  const resultItems = result.equipment.equipment as Array<Record<string, unknown>>
  assert.equal(resultItems.length, 14)
  assert.deepEqual(resultItems[0]!.tune, [{ level: 3 }])
  assert.deepEqual(resultItems[0]!.enchant, items[0]!.enchant)
  assert.deepEqual(
    (result.skillStyle as Record<string, unknown>).style,
    (original.skillStyle as Record<string, unknown>).style
  )
  assert.equal(Object.hasOwn(result.skillStyle as object, 'skillDetails'), false)
  assert.equal(Object.hasOwn(result, 'setDetails'), false)
})

test('연결 종료 뒤 늦은 성공은 반환하지 않고 연결된 요청의 성공만 반환한다', async () => {
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
    const service = createCatalogService(async (keys, requestSignal) => {
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
    } else {
      const result = await pending
      assert.deepEqual(result.get(catalogKey(item))!.detail.data, {
        itemId: 'fixture-item',
        itemName: '합성 아이템 fixture-item',
        late: true
      })
    }
  }
})

test('이미 취소된 공용 상세 요청은 전송하지 않는다', async () => {
  let calls = 0
  const adapter = createNeopleCatalog('fixture-key', async () => {
    calls++

    return Response.json({ rows: [] })
  })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(adapter([item], controller.signal), { message: 'Catalog lookup failed' })
  assert.equal(calls, 0)
})

test('아이템 다중 응답의 누락, 중복, 잘못된 이름은 저장 대상에서 제외하고 올바른 이웃만 유지한다', async () => {
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
