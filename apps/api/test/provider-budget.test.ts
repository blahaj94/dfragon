import assert from 'node:assert/strict'
import test from 'node:test'
import { NeopleBudget } from '../src/characters/provider-budget.js'
import { createNeopleCharacterSearchForTest } from '../src/characters/neople-character-search.js'
import { createNeopleCharacterDetailsForTest } from '../src/characters/details/neople.js'
import { createNeopleCatalog } from '../src/characters/catalog/neople.js'
import { SearchAdmission } from '../src/characters/search-admission.js'

// character-search.md의 서비스 보호 상한: 최근 60초 600회, body 수신까지 동시 12회.
// 구현 상수를 기대값으로 가져오면 잘못된 상한 변경도 함께 통과하므로 독립 사례로 고정한다.
test('검색·상세·공용 상세의 성공과 실패는 같은 600회 예산을 소비하고 60초 경계에서 만료된다', async () => {
  let now = 0
  const budget = new NeopleBudget(() => now)
  const providerFailure = new Error('합성 공급자 실패')
  for (let i = 0; i < 597; i++) {
    await assert.rejects(
      budget.run(async () => {
        throw providerFailure
      }),
      (error) => error === providerFailure
    )
  }
  const paths: string[] = []
  const item = { itemId: 'fixture-item', itemName: '합성 장비', itemRarity: '에픽' }
  const transport: typeof fetch = async (input) => {
    const url = new URL(String(input))
    paths.push(url.pathname)
    if (url.pathname === '/df/servers/siroco/characters') {
      return Response.json({ rows: [] })
    }

    if (url.pathname === '/df/servers/siroco/characters/fixture-character') {
      return Response.json(
        { error: { code: 'API003', message: '합성 공급자 원문' } },
        { status: 401 }
      )
    }
    assert.equal(url.pathname, '/df/multi/items')
    assert.equal(url.searchParams.get('itemIds'), 'fixture-item')

    return Response.json({ rows: [item] })
  }
  const search = createNeopleCharacterSearchForTest('fixture', { fetch: transport }, budget)
  const details = createNeopleCharacterDetailsForTest('fixture', { fetch: transport, budget })
  const catalog = createNeopleCatalog('fixture', transport, budget)
  const input = { characterName: '합성', serverId: 'siroco', limit: 10 }
  const identity = { serverId: 'siroco', characterId: 'fixture-character' }
  const signal = new AbortController().signal
  assert.deepEqual(await search(input), { rows: [] })
  await assert.rejects(details(identity, signal), {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 오류로 캐릭터 정보를 처리하지 못했습니다.'
      }
    }
  })
  assert.deepEqual(await catalog([{ kind: 'item', itemId: 'fixture-item' }], signal), [
    { key: { kind: 'item', itemId: 'fixture-item' }, payload: item }
  ])
  await assert.rejects(search(input), { status: 429, retryAfter: 60 })
  await assert.rejects(details(identity, signal), { status: 429, retryAfter: 60 })
  await assert.rejects(catalog([{ kind: 'item', itemId: 'fixture-item' }], signal), {
    status: 429,
    retryAfter: 60
  })
  assert.deepEqual(paths, [
    '/df/servers/siroco/characters',
    '/df/servers/siroco/characters/fixture-character',
    '/df/multi/items'
  ])
  now = 59_999
  await assert.rejects(search(input), { status: 429, retryAfter: 1 })
  now = 60_000
  assert.deepEqual(await search(input), { rows: [] })
  assert.deepEqual(paths, [
    '/df/servers/siroco/characters',
    '/df/servers/siroco/characters/fixture-character',
    '/df/multi/items',
    '/df/servers/siroco/characters'
  ])
})

test('동시 슬롯 12개는 응답 body가 완료될 때까지 유지되고 완료 후 반환된다', async () => {
  const budget = new NeopleBudget()
  let calls = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let bodyReads = 0
  let markAllBodiesReading!: () => void
  const allBodiesReading = new Promise<void>((resolve) => {
    markAllBodiesReading = resolve
  })
  const transport: typeof fetch = async () => {
    calls++
    if (calls > 12) {
      return Response.json({ rows: [] })
    }

    return new Response(
      new ReadableStream(
        {
          async pull(controller) {
            bodyReads++
            if (bodyReads === 12) {
              markAllBodiesReading()
            }
            await gate
            controller.enqueue(new TextEncoder().encode('{"rows":[]}'))
            controller.close()
          }
        },
        // 선행 buffering 없이 adapter가 headers 이후 body를 실제로 읽을 때 관측한다.
        { highWaterMark: 0 }
      )
    )
  }
  const search = createNeopleCharacterSearchForTest('fixture', { fetch: transport }, budget)
  const input = { characterName: '합성', serverId: 'siroco', limit: 10 }
  const pending = Array.from({ length: 12 }, () => search(input))
  try {
    await allBodiesReading
    assert.equal(bodyReads, 12)
    await assert.rejects(search(input), { status: 429, retryAfter: 1 })
    assert.equal(calls, 12)
  } finally {
    release()
  }
  assert.deepEqual(
    await Promise.all(pending),
    Array.from({ length: 12 }, () => ({ rows: [] }))
  )
  assert.deepEqual(await search(input), { rows: [] })
  assert.equal(calls, 13)
})

test('동시 한도 거절은 호출 예산을 소비하지 않고 실패한 작업도 슬롯을 반환한다', async () => {
  const budget = new NeopleBudget(() => 0)
  let fail!: (error: Error) => void
  const gate = new Promise<void>((_resolve, reject) => {
    fail = reject
  })
  const providerFailure = new Error('합성 body 수신 실패')
  const pending = Array.from({ length: 12 }, () => budget.run(() => gate))
  const settled = Promise.allSettled(pending)
  let rejectedWorkStarted = false
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      await assert.rejects(
        budget.run(async () => {
          rejectedWorkStarted = true
        }),
        { status: 429, retryAfter: 1 }
      )
    }
    assert.equal(rejectedWorkStarted, false)
  } finally {
    fail(providerFailure)
  }
  for (const result of await settled) {
    assert.deepEqual(result, { status: 'rejected', reason: providerFailure })
  }
  // 이미 실패한 12회는 환불되지 않지만 동시 한도로 거절한 3회는 시작되지 않았다.
  for (let index = 0; index < 588; index++) {
    assert.equal(await budget.run(async () => index), index)
  }
  await assert.rejects(
    budget.run(async () => {
      rejectedWorkStarted = true
    }),
    { status: 429, retryAfter: 60 }
  )
  assert.equal(rejectedWorkStarted, false)
})

test('동기 예외 뒤에도 슬롯이 반환되고 서로 다른 시작 시각은 각자의 60초 창에서 만료된다', async () => {
  let now = 0
  const budget = new NeopleBudget(() => now)
  const failure = new Error('합성 transport 시작 실패')
  await assert.rejects(
    budget.run(() => {
      throw failure
    }),
    (error) => error === failure
  )
  now = 1_000
  for (let index = 0; index < 599; index++) {
    await budget.run(async () => undefined)
  }
  now = 59_001
  await assert.rejects(
    budget.run(async () => undefined),
    { status: 429, retryAfter: 1 }
  )
  now = 60_000
  assert.equal(await budget.run(async () => '첫 예약 만료'), '첫 예약 만료')
  await assert.rejects(
    budget.run(async () => undefined),
    { status: 429, retryAfter: 1 }
  )
  now = 61_000
  for (let index = 0; index < 599; index++) {
    assert.equal(await budget.run(async () => index), index)
  }
  await assert.rejects(
    budget.run(async () => undefined),
    { status: 429, retryAfter: 59 }
  )
})

test('동일 IPv6 /64와 IPv4-mapped 표현은 같은 IP 한도를 공유하고 다른 대역은 독립적이다', async () => {
  const admission = new SearchAdmission()
  const reserve = async (ip: string) => {
    const lease = await admission.acquire(ip, new AbortController().signal)
    try {
      lease.reserve()
    } finally {
      lease.release()
    }
  }
  try {
    for (let i = 1; i <= 10; i++) {
      await reserve(`2001:db8:1:2::${i}`)
    }
    await assert.rejects(reserve('2001:0db8:0001:0002:0:0:0:ffff'), { status: 429 })
    await reserve('2001:db8:1:3::1')
    for (let i = 0; i < 10; i++) {
      await reserve(i % 2 ? '192.0.2.1' : '::ffff:192.0.2.1')
    }
    await assert.rejects(reserve('192.0.2.1'), { status: 429 })
  } finally {
    admission.close()
  }
})
