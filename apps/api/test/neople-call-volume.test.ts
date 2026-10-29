import assert from 'node:assert/strict'
import test from 'node:test'
import { createNeopleCharacterSearchForTest } from '../src/characters/neople-character-search.js'
import { createNeopleCharacterDetailsForTest } from '../src/characters/details/neople.js'
import { createNeopleCatalog } from '../src/characters/catalog/neople.js'
import type { FetchTransport } from '../src/types/neople-character-search.js'

// 2026-10-20 #778 결정으로 프로세스 전체 Neople 예산(최근 60초 600회, 동시 12회)을 없앴다.
// 예전 상한보다 많이 보내 거절 없이 실제 transport 수가 맞는지 확인한다.
const input = { characterName: '합성', serverId: 'siroco', limit: 10 }

test('검색을 예전 상한보다 많은 601회 보내도 모두 Neople까지 간다', async () => {
  let calls = 0
  const transport: typeof fetch = async () => {
    calls++

    return Response.json({ rows: [] })
  }
  const search = createNeopleCharacterSearchForTest('fixture', { fetch: transport })
  for (let index = 0; index < 601; index++) {
    assert.deepEqual(await search(input), { rows: [] })
  }
  assert.equal(calls, 601)
})

test('body를 받는 중인 검색이 13개여도 새 검색을 거절하지 않는다', { timeout: 2_000 }, async () => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let bodyReads = 0
  let markAllBodiesReading!: () => void
  const allBodiesReading = new Promise<void>((resolve) => {
    markAllBodiesReading = resolve
  })
  const transport: typeof fetch = async () =>
    new Response(
      new ReadableStream(
        {
          async pull(controller) {
            bodyReads++
            if (bodyReads === 13) {
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
  const search = createNeopleCharacterSearchForTest('fixture', { fetch: transport })
  const pending = Array.from({ length: 13 }, () => search(input))
  try {
    await allBodiesReading
  } finally {
    release()
  }
  assert.deepEqual(
    await Promise.all(pending),
    Array.from({ length: 13 }, () => ({ rows: [] }))
  )
})

async function expectThirteenOpenTransports(
  start: (transport: FetchTransport) => Promise<unknown>[],
  expectedFailure: object
) {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let opened = 0
  let markThirteen!: () => void
  const thirteenOpened = new Promise<void>((resolve) => {
    markThirteen = resolve
  })
  const transport: FetchTransport = async (request) => {
    const url = new URL(request.url)
    if (url.pathname === '/df/servers/siroco/characters/fixture-character') {
      return Response.json({
        serverId: 'siroco',
        characterId: 'fixture-character',
        characterName: '합성 캐릭터'
      })
    }
    opened++
    if (opened === 13) {
      markThirteen()
    }
    await gate

    return Response.json({ error: { code: 'API901', message: '합성 공급자 원문' } })
  }
  const pending = start(transport)
  try {
    await thirteenOpened
  } finally {
    release()
  }
  await Promise.all(pending.map((operation) => assert.rejects(operation, expectedFailure)))
}

test('상세 5건은 응답 전에 섹션 transport 13개 이상을 함께 연다', { timeout: 2_000 }, async () => {
  const identity = { serverId: 'siroco', characterId: 'fixture-character' }
  await expectThirteenOpenTransports(
    (transport) => {
      const details = createNeopleCharacterDetailsForTest('fixture', { fetch: transport })

      return Array.from({ length: 5 }, () =>
        details(identity, new AbortController().signal, () => undefined)
      )
    },
    { status: 502 }
  )
})

test('공용 상세 13건은 응답 전에 모두 transport를 연다', { timeout: 2_000 }, async () => {
  await expectThirteenOpenTransports(
    (transport) => {
      const catalog = createNeopleCatalog('fixture', transport)

      return Array.from({ length: 13 }, () =>
        catalog(['fixture-item'], new AbortController().signal)
      )
    },
    { message: 'Catalog lookup failed' }
  )
})
