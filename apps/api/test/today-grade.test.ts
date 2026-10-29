import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createApiHttpApp } from '../src/http.js'
import { TodayGradeFailure } from '../src/today-grade/errors.js'
import { averageGradePercent, nextGradeResetAt } from '../src/today-grade/grade.js'
import { TODAY_GRADE_ITEMS } from '../src/today-grade/items.js'
import { createNeopleShopGrade, type FetchShopGrade } from '../src/today-grade/neople.js'
import { createTodayGradeService } from '../src/today-grade/service.js'

const signal = new AbortController().signal
// 2026-10-30 12:00 KST
const noonKst = new Date('2026-10-30T03:00:00.000Z')
const nextMidnightKst = '2026-10-30T15:00:00.000Z'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function recordingShopGrade(value: (itemId: string) => number | Promise<number>) {
  const calls: string[] = []
  const fetchShopGrade: FetchShopGrade = async (itemId) => {
    calls.push(itemId)

    return value(itemId)
  }

  return { calls, fetchShopGrade }
}

test('다음 등급 갱신 시각은 한국 시간 다음 0시이고, 0시 정각에는 그다음 날 0시다', () => {
  assert.equal(nextGradeResetAt(noonKst).toISOString(), nextMidnightKst)
  assert.equal(
    nextGradeResetAt(new Date('2026-10-30T14:59:59.999Z')).toISOString(),
    nextMidnightKst
  )
  assert.equal(
    nextGradeResetAt(new Date(nextMidnightKst)).toISOString(),
    '2026-10-31T15:00:00.000Z'
  )
})

test('11부위 등급의 평균을 정수 퍼센트로 반올림한다', () => {
  assert.equal(averageGradePercent(Array(11).fill(85)), 85)
  // (10 × 85 + 79) / 11 = 84.45, (10 × 85 + 96) / 11 = 86
  assert.equal(averageGradePercent([...Array(10).fill(85), 79]), 84)
  assert.equal(averageGradePercent([...Array(10).fill(85), 96]), 86)
})

test('11개 대표 아이템의 상점 등급 평균을 다음 0시까지 다시 조회하지 않고 준다', async () => {
  let now = noonKst
  const { calls, fetchShopGrade } = recordingShopGrade((itemId) =>
    itemId === TODAY_GRADE_ITEMS[0].itemId ? 74 : 86
  )
  const service = createTodayGradeService(fetchShopGrade, () => now)
  const expected = { percent: 85, expiresAt: nextMidnightKst }

  assert.deepEqual(await service.get(signal), expected)
  assert.equal(calls.length, 11)
  assert.deepEqual(calls.toSorted(), TODAY_GRADE_ITEMS.map(({ itemId }) => itemId).toSorted())
  now = new Date('2026-10-30T14:59:59.999Z')
  assert.deepEqual(await service.get(signal), expected)
  assert.equal(calls.length, 11)

  now = new Date(nextMidnightKst)
  assert.deepEqual(await service.get(signal), {
    percent: 85,
    expiresAt: '2026-10-31T15:00:00.000Z'
  })
  assert.equal(calls.length, 22)
})

test('동시에 들어온 요청은 한 번의 조회를 함께 기다린다', async () => {
  const { calls, fetchShopGrade } = recordingShopGrade(() => 90)
  const service = createTodayGradeService(fetchShopGrade, () => noonKst)
  const [left, right] = await Promise.all([service.get(signal), service.get(signal)])

  assert.equal(calls.length, 11)
  assert.deepEqual(left, right)
})

test('요청 하나의 연결이 끊겨도 함께 기다리던 다른 요청은 같은 조회의 결과를 받는다', async () => {
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const { calls, fetchShopGrade } = recordingShopGrade(async () => {
    await gate

    return 90
  })
  const service = createTodayGradeService(fetchShopGrade, () => noonKst)
  const disconnected = new AbortController()
  const left = service.get(disconnected.signal)
  const right = service.get(signal)
  disconnected.abort()
  release()

  await assert.rejects(left, TodayGradeFailure)
  assert.deepEqual(await right, { percent: 90, expiresAt: nextMidnightKst })
  assert.equal(calls.length, 11)
})

test('서버를 종료하면 진행 중인 상점 조회를 취소하고 끝나기를 기다린다', async () => {
  const signals: AbortSignal[] = []
  const service = createTodayGradeService(
    (_itemId, fetchSignal) =>
      new Promise<number>((_resolve, reject) => {
        signals.push(fetchSignal)
        fetchSignal.addEventListener('abort', () => reject(fetchSignal.reason), { once: true })
      }),
    () => noonKst
  )
  const pending = service.get(signal)

  await service.onModuleDestroy()

  assert.equal(signals.length, 11)
  assert.ok(signals.every((fetchSignal) => fetchSignal.aborted))
  await assert.rejects(pending, TodayGradeFailure)
})

test('한 부위라도 실패하면 결과 없이 실패하고, 실패는 저장하지 않아 다음 요청이 다시 조회한다', async () => {
  let failing = true
  const { calls, fetchShopGrade } = recordingShopGrade((itemId) => {
    if (failing && itemId === TODAY_GRADE_ITEMS[5].itemId) {
      throw new TodayGradeFailure('unavailable')
    }

    return 90
  })
  const service = createTodayGradeService(fetchShopGrade, () => noonKst)

  await assert.rejects(service.get(signal), (error) => {
    assert(error instanceof TodayGradeFailure)
    assert.equal(error.status, 503)

    return true
  })
  failing = false
  const callsBeforeRetry = calls.length
  assert.deepEqual(await service.get(signal), { percent: 90, expiresAt: nextMidnightKst })
  assert.equal(calls.length - callsBeforeRetry, 11)
})

test('상점 조회는 아이템마다 /df/items/{itemId}/shop을 부르고 itemGradeValue를 읽는다', async () => {
  const requests: Request[] = []
  const fetchShopGrade = createNeopleShopGrade('synthetic-shop-key', async (request) => {
    requests.push(request)

    return jsonResponse({ itemId: 'item-a', itemGradeName: '최상급', itemGradeValue: 97 })
  })

  assert.equal(await fetchShopGrade('item-a', signal), 97)
  assert.equal(requests.length, 1)
  assert.equal(new URL(requests[0]!.url).pathname, '/df/items/item-a/shop')
  assert.equal(requests[0]!.headers.get('apikey'), 'synthetic-shop-key')
})

test('Neople 오류 코드와 잘못된 등급 값을 오늘의 등급 오류로 바꾼다', async () => {
  const cases: [string, Response, number][] = [
    ['점검 오류 코드', jsonResponse({ error: { code: 'API002' } }, 503), 503],
    ['등급 값 없음', jsonResponse({ itemId: 'item-a', itemGradeName: '최상급' }), 502],
    ['문자열 등급 값', jsonResponse({ itemId: 'item-a', itemGradeValue: '97' }), 502],
    ['100을 넘는 등급 값', jsonResponse({ itemId: 'item-a', itemGradeValue: 101 }), 502],
    ['JSON이 아닌 응답', new Response('<html>', { status: 200 }), 502]
  ]
  for (const [name, response, status] of cases) {
    const fetchShopGrade = createNeopleShopGrade('synthetic-shop-key', async () => response)
    await assert.rejects(fetchShopGrade('item-a', signal), (error) => {
      assert(error instanceof TodayGradeFailure, name)
      assert.equal(error.status, status, name)

      return true
    })
  }
})

test('GET /items/today-grade는 등급 퍼센트와 만료 시각을, 실패하면 오류 본문을 준다', async (t) => {
  const unusedProvider = async (): Promise<never> => {
    throw new Error('today grade test must not call character providers')
  }
  let failing = true
  const app = await createApiHttpApp({
    search: { searchCharacters: unusedProvider },
    details: { fetchDetails: unusedProvider, catalog: createCatalogService(unusedProvider) },
    todayGrade: {
      fetchShopGrade: async () => {
        if (failing) {
          throw new TodayGradeFailure('timeout')
        }

        return 85
      }
    },
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  const failed = await fetch(`${origin}/items/today-grade`)
  assert.equal(failed.status, 504)
  assert.deepEqual(await failed.json(), {
    error: {
      code: 'NEOPLE_TIMEOUT',
      message: '오늘의 등급 조회 시간이 초과됐습니다. 다시 시도해 주세요.'
    }
  })

  failing = false
  const response = await fetch(`${origin}/items/today-grade`)
  assert.equal(response.status, 200)
  const body = (await response.json()) as { percent: unknown; expiresAt: unknown }
  assert.equal(body.percent, 85)
  assert.equal(typeof body.expiresAt, 'string')
  assert.ok(Date.parse(body.expiresAt as string) > Date.now())
})
