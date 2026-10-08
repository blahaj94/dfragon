import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { createApiHttpApp } from '../src/http.js'
import { createNeopleCharacterAppearanceForTest } from '../src/characters/appearance/neople.js'
import { createNeopleCharacterSearchForTest } from '../src/characters/neople-character-search.js'
import { NeopleBudget } from '../src/characters/provider-budget.js'
import {
  appearance,
  identity,
  payload,
  AppearanceClock,
  completionSignal
} from './character-appearance-fixtures.js'

test('appearance의 공급자 오류를 정제하고 재시도, 부분 성공으로 숨기지 않는다', async (t) => {
  for (const [status, body, expected] of [
    [503, { error: { code: 'API901', message: 'synthetic-private' } }, 502],
    [401, { error: { code: 'API003', message: 'synthetic-private' } }, 500],
    [503, 'broken-json', 503],
    [200, 'broken-json', 502],
    [200, { error: { code: 'API002', message: 'synthetic-private' } }, 503]
  ] as const) {
    await t.test(`${status} -> ${expected}`, async () => {
      let calls = 0
      const adapter = createNeopleCharacterAppearanceForTest('synthetic-key', {
        fetch: async () => {
          calls++
          const text = typeof body === 'string' ? body : JSON.stringify(body)

          return new Response(text, { status })
        }
      })
      await assert.rejects(adapter(identity, new AbortController().signal), (error: unknown) => {
        assert(error instanceof Error && 'status' in error && 'body' in error)
        assert.equal(error.status, expected)
        assert(!JSON.stringify(error.body).includes('synthetic-private'))
        assert(!error.stack?.includes('synthetic-key'))

        return true
      })
      assert.equal(calls, 1)
    })
  }
})

test('body를 소비하는 동안에도 정확한 5초 예산을 적용하고 raw stream을 취소한다', async () => {
  const clock = new AppearanceClock()
  const reading = completionSignal()
  let canceled = 0
  let signal: AbortSignal | null | undefined
  const adapter = createNeopleCharacterAppearanceForTest('synthetic-key', {
    clock,
    fetch: async (_input, init) => {
      signal = init?.signal

      return new Response(
        new ReadableStream(
          {
            pull() {
              reading.resolve()
            },
            cancel() {
              canceled++
            }
          },
          { highWaterMark: 0 }
        )
      )
    }
  })
  const pending = adapter(identity, new AbortController().signal)
  const rejected = assert.rejects(pending, {
    status: 504,
    body: {
      error: {
        code: 'NEOPLE_TIMEOUT',
        message: '캐릭터 정보 조회 시간이 초과됐습니다. 다시 시도해 주세요.'
      }
    }
  })
  await reading.promise
  clock.advance(4_999)
  assert.equal(signal?.aborted, false)
  clock.advance(5_000)
  await rejected
  assert.equal(signal?.aborted, true)
  assert.equal(canceled, 1)
  assert.equal(clock.timerCount, 0)
})

function oneMebibytePayload(): Uint8Array {
  const emptyPadding = JSON.stringify({ ...payload(), padding: '' })
  const remainingBytes = 1_048_576 - Buffer.byteLength(emptyPadding, 'utf8')
  const padding = '가'.repeat(Math.floor(remainingBytes / 3)) + ' '.repeat(remainingBytes % 3)
  const text = JSON.stringify({ ...payload(), padding })
  assert.equal(Buffer.byteLength(text, 'utf8'), 1_048_576)
  assert(text.length < 1_048_576)

  return new TextEncoder().encode(text)
}

test('정확히 1MiB인 JSON은 UTF-8 문자 중간에서 chunk가 갈려도 원문대로 읽는다', async () => {
  const bytes = oneMebibytePayload()
  const split = Buffer.from(bytes).indexOf(Buffer.from('합성')) + 1
  assert(split > 0)
  const chunks = [bytes.subarray(0, split), bytes.subarray(split)]
  const adapter = createNeopleCharacterAppearanceForTest('synthetic-key', {
    fetch: async () =>
      new Response(
        new ReadableStream(
          {
            pull(controller) {
              const chunk = chunks.shift()
              if (chunk === undefined) {
                controller.close()
              } else {
                controller.enqueue(chunk)
              }
            }
          },
          { highWaterMark: 0 }
        ),
        { headers: { 'content-length': '1' } }
      )
  })

  assert.deepEqual(await adapter(identity, new AbortController().signal), appearance)
})

test('Content-Length와 무관하게 실측 1MiB 초과 chunk를 디코딩 전에 거절하고 reader와 동시 슬롯을 반환한다', async (t) => {
  const cases: Array<[string, Record<string, string>]> = [
    ['길이 헤더 없음', {}],
    ['실제보다 작은 길이 헤더', { 'content-length': '1' }]
  ]
  for (const [name, headers] of cases) {
    await t.test(name, async () => {
      const clock = new AppearanceClock()
      const budget = new NeopleBudget()
      const chunks = [oneMebibytePayload(), new Uint8Array([32])]
      let canceled = 0
      let reads = 0
      const adapter = createNeopleCharacterAppearanceForTest('synthetic-key', {
        budget,
        clock,
        fetch: async () =>
          new Response(
            new ReadableStream(
              {
                pull(controller) {
                  reads++
                  const chunk = chunks.shift()
                  if (chunk === undefined) {
                    controller.close()
                  } else {
                    controller.enqueue(chunk)
                  }
                },
                cancel() {
                  canceled++
                }
              },
              { highWaterMark: 0 }
            ),
            { headers }
          )
      })

      await assert.rejects(adapter(identity, new AbortController().signal), {
        status: 502,
        body: {
          error: { code: 'NEOPLE_API_ERROR', message: '캐릭터 정보 조회 중 오류가 발생했습니다.' }
        }
      })
      assert.equal(reads, 2)
      assert.equal(canceled, 1)
      assert.equal(clock.timerCount, 0)
      await Promise.all(Array.from({ length: 12 }, () => budget.run(async () => undefined)))
    })
  }
})

test('실행이 지연된 timer 대신 완료 시각으로도 5초를 검사한다', async () => {
  for (const completedAt of [4_999, 5_000]) {
    const clock = new AppearanceClock()
    let signal: AbortSignal | null | undefined
    const adapter = createNeopleCharacterAppearanceForTest('synthetic-key', {
      clock,
      fetch: async (_input, init) => {
        signal = init?.signal
        clock.value = completedAt

        return Response.json(payload())
      }
    })
    const operation = adapter(identity, new AbortController().signal)
    if (completedAt === 4_999) {
      assert.deepEqual(await operation, appearance)
      assert.equal(signal?.aborted, false)
    } else {
      await assert.rejects(operation, { status: 504 })
      assert.equal(signal?.aborted, true)
    }
    assert.equal(clock.timerCount, 0)
  }
})

test('미리 취소된 요청은 공급자 예산과 transport를 소비하지 않는다', async () => {
  const clock = new AppearanceClock()
  let calls = 0
  const controller = new AbortController()
  controller.abort()
  const adapter = createNeopleCharacterAppearanceForTest('synthetic-key', {
    clock,
    fetch: async () => {
      calls++

      return Response.json(payload())
    }
  })
  await assert.rejects(adapter(identity, controller.signal), { status: 500 })
  assert.equal(calls, 0)
  assert.equal(clock.timerCount, 0)
})

test('appearance body가 끝나기 전까지 공유 동시 12개를 차지하며 취소 뒤 검색 슬롯을 반환한다', async () => {
  const budget = new NeopleBudget()
  const clock = new AppearanceClock()
  const allReading = completionSignal()
  let bodyReads = 0
  let bodyCancels = 0
  let searchCalls = 0
  const adapter = createNeopleCharacterAppearanceForTest('synthetic-key', {
    budget,
    clock,
    fetch: async () =>
      new Response(
        new ReadableStream(
          {
            pull() {
              bodyReads++
              if (bodyReads === 12) {
                allReading.resolve()
              }
            },
            cancel() {
              bodyCancels++
            }
          },
          { highWaterMark: 0 }
        )
      )
  })
  const search = createNeopleCharacterSearchForTest(
    'synthetic-key',
    {
      fetch: async () => {
        searchCalls++

        return Response.json({ rows: [] })
      }
    },
    budget
  )
  const controller = new AbortController()
  const pending = Array.from({ length: 12 }, () => adapter(identity, controller.signal))
  const completed = Promise.allSettled(pending)
  await allReading.promise
  await assert.rejects(search({ serverId: 'all', characterName: '합성', limit: 10 }), {
    status: 429,
    retryAfter: 1
  })
  assert.equal(searchCalls, 0)
  controller.abort()
  assert((await completed).every((result) => result.status === 'rejected'))
  assert.equal(bodyCancels, 12)
  assert.deepEqual(await search({ serverId: 'all', characterName: '합성', limit: 10 }), {
    rows: []
  })
  assert.equal(searchCalls, 1)
  assert.equal(clock.timerCount, 0)
})

async function loopback(
  t: TestContext,
  handler: (request: IncomingMessage, response: ServerResponse) => void
): Promise<string> {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    )
  })
  const address = server.address()
  assert(address !== null && typeof address === 'object')

  return `http://127.0.0.1:${address.port}`
}

test('timer가 늦어도 headers 시점에 5초가 지나면 native body 연결을 닫는다', {
  timeout: 2_000
}, async (t) => {
  const closed = completionSignal()
  const clock = new AppearanceClock()
  const origin = await loopback(t, (_request, response) => {
    response.once('close', () => closed.resolve())
    response.writeHead(200, { 'content-type': 'application/json' })
    response.write('{"avatar":[')
  })
  const adapter = createNeopleCharacterAppearanceForTest('synthetic-key', {
    origin,
    clock,
    fetch: async (input, init) => {
      const response = await fetch(input, init)
      clock.value = 5_000

      return response
    }
  })
  await assert.rejects(adapter(identity, new AbortController().signal), { status: 504 })
  await closed.promise
  assert.equal(clock.timerCount, 0)
})

for (const action of ['disconnect', 'shutdown'] as const) {
  test(`${action}는 API에서 native 공급자 body까지 취소를 전파한다`, {
    timeout: 2_000
  }, async (t) => {
    const started = completionSignal()
    const closed = completionSignal()
    let calls = 0
    const upstream = await loopback(t, (_request, response) => {
      calls++
      response.once('close', () => closed.resolve())
      response.writeHead(200, { 'content-type': 'application/json' })
      response.write('{"avatar":[')
      started.resolve()
    })
    const fetchAppearance = createNeopleCharacterAppearanceForTest('synthetic-key', {
      origin: upstream,
      fetch
    })
    const app = await createApiHttpApp(
      { searchCharacters: async () => ({ rows: [] }) },
      undefined,
      undefined,
      undefined,
      undefined,
      { fetchAppearance }
    )
    t.after(() => app.close())
    await app.listen(0, '127.0.0.1')
    const controller = new AbortController()
    const response = fetch(
      `${await app.getUrl()}/characters/${identity.serverId}/${identity.characterId}/appearance`,
      { signal: controller.signal }
    )
    await started.promise
    if (action === 'disconnect') {
      const rejected = assert.rejects(response, { name: 'AbortError' })
      controller.abort()
      await rejected
    } else {
      await app.close()
      assert.equal((await response).status, 500)
    }
    await closed.promise
    assert.equal(calls, 1)
  })
}
