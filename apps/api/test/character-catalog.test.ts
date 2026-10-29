import assert from 'node:assert/strict'
import test from 'node:test'
import { createNeopleCatalog } from '../src/characters/catalog/neople.js'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { enrichCharacterDetails } from '../src/characters/catalog/enrich.js'
import type { projectCharacterDetails } from '../src/characters/details/project.js'

const signal = new AbortController().signal
const item = 'fixture-item'
function catalogPayload(itemId: string) {
  return { itemId, itemName: '합성 아이템 ' + itemId }
}
function catalogPayloads(itemIds: string[]) {
  return new Map(itemIds.map((itemId) => [itemId, catalogPayload(itemId)]))
}
test('중복을 제거한 128개까지만 조회하고 15개 이하 배치 9개를 모두 동시에 시작한다', async () => {
  let active = 0,
    peak = 0,
    count = 0
  const service = createCatalogService(async (itemIds) => {
    assert(itemIds.length <= 15)
    active++
    peak = Math.max(active, peak)
    count += itemIds.length
    await Promise.resolve()
    active--

    return catalogPayloads(itemIds)
  })
  const itemIds = Array.from({ length: 140 }, (_, i) => `item-${i}`)
  const result = await service.load([...itemIds, itemIds[0]!], signal)
  assert.equal(count, 128)
  // 예전 동시 3 batch 제한에서는 peak가 3이었다.
  assert.equal(peak, 9)
  assert.equal(result.size, 140)
  for (const [index, itemId] of itemIds.entries()) {
    const expectedData = index < 128 ? catalogPayload(itemId) : null
    const expectedStatus = index < 128 ? 'fresh' : 'unavailable'
    const detail = result.get(itemId)!
    assert.deepEqual(detail.data, expectedData)
    assert.equal(detail.status, expectedStatus)
    assert.equal(detail.fetchedAt === null, index >= 128)
  }
})

test('연결이 이미 끊긴 요청은 공용 아이템을 조회하지 않는다', async () => {
  let calls = 0
  const service = createCatalogService(async (itemIds) => {
    calls++

    return catalogPayloads(itemIds)
  })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(service.load([item], controller.signal), { name: 'AbortError' })
  assert.equal(calls, 0)
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
  const values = await createNeopleCatalog('fixture-key', fetchImpl)([item, 'missing'])
  assert.deepEqual([...values.keys()], [item])
  assert.deepEqual(values.get(item)!.option, { value: '3%' })
  assert(!requestPaths[0]!.includes('fixture-key'))
  const failure = createNeopleCatalog('fixture-key', async () => {
    throw new Error('secret upstream message')
  })
  await assert.rejects(failure([item]), { message: 'Catalog lookup failed' })
  let unavailableCalls = 0
  const unavailable = createNeopleCatalog('fixture-key', async () => {
    unavailableCalls++

    return Response.json({ error: { message: 'secret upstream message' } }, { status: 503 })
  })
  await assert.rejects(unavailable([item]), { message: 'Catalog lookup failed' })
  // 503은 HTTP client 기본 재시도 대상이지만 공용 상세 조회는 재시도하지 않는다.
  assert.equal(unavailableCalls, 1)
  const service = createCatalogService(async () => {
    throw new Error('secret upstream message')
  })
  const result = await service.load([item], signal)
  assert.equal(result.get(item)!.status, 'unavailable')
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
  const service = createCatalogService(async (itemIds) => {
    requested += itemIds.length

    return new Map(
      itemIds.map((itemId) => [itemId, { ...catalogPayload(itemId), tune: [{ level: 0 }] }])
    )
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

test('아이템 다중 응답의 누락, 중복, 잘못된 이름은 저장 대상에서 제외하고 올바른 이웃만 유지한다', async () => {
  const wanted = ['valid', 'duplicate', 'missing', 'bad-name']
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

  assert.deepEqual(await adapter(wanted), new Map([['valid', valid]]))
})
