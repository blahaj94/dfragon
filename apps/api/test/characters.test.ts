import assert from 'node:assert/strict'
import test from 'node:test'
import { createNeopleCharacterSearchForTest } from '../src/characters/neople-character-search.js'
import { NEOPLE_SERVER_NAMES } from '../src/constants/neople-character-search.js'
import { NeopleSearchFailure } from '../src/errors/neople-search.js'

const input = { characterName: '가나다', serverId: 'cain', limit: 10 }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function jsonStreamResponse(body: unknown, beforeRead: () => void): Response {
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        beforeRead()
        controller.enqueue(new TextEncoder().encode(JSON.stringify(body)))
        controller.close()
      }
    },
    { highWaterMark: 0 }
  )

  return new Response(stream, { headers: { 'content-type': 'application/json' } })
}

function rawResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } })
}

async function expectFailure(
  promise: Promise<unknown>,
  status: number,
  code: string,
  message: string
): Promise<NeopleSearchFailure> {
  try {
    await promise
  } catch (error) {
    const isSearchFailure = error instanceof NeopleSearchFailure
    assert(isSearchFailure)
    assert.equal(error.status, status)
    assert.deepEqual(error.body, { error: { code, message } })

    return error
  }
  assert.fail('검색 실패를 예상했습니다.')
}

test('계약의 전체 서버 map을 제공하고 prototype key를 서버로 취급하지 않는다', () => {
  assert.deepEqual(
    [...NEOPLE_SERVER_NAMES],
    [
      ['anton', '안톤'],
      ['bakal', '바칼'],
      ['cain', '카인'],
      ['casillas', '카시야스'],
      ['diregie', '디레지에'],
      ['hilder', '힐더'],
      ['prey', '프레이'],
      ['siroco', '시로코']
    ]
  )
  assert.equal(NEOPLE_SERVER_NAMES.get('all'), undefined)
  assert.equal(NEOPLE_SERVER_NAMES.get('constructor'), undefined)
  assert.equal(NEOPLE_SERVER_NAMES.get('__proto__'), undefined)
})

test('후보 순서, 값을 보존하며 응답을 다섯 field로 정제한다', async () => {
  const search = createNeopleCharacterSearchForTest('fake-key', {
    fetch: async () =>
      jsonResponse({
        ignored: true,
        rows: [
          {
            characterId: ' id-1 ',
            characterName: ' 이름 ',
            serverId: 'cain',
            serverName: 'wrong upstream name',
            fame: 0,
            extra: 'ignored'
          },
          {
            characterId: 'id-2',
            characterName: '둘째',
            serverId: 'future-server',
            fame: -1.5
          },
          {
            characterId: 'id-3',
            characterName: '셋째',
            serverId: 'constructor',
            fame: null
          },
          { characterId: 'id-4', characterName: '넷째', serverId: '__proto__' }
        ]
      })
  })

  const result = await search(input)

  assert.deepEqual(result, {
    rows: [
      {
        characterId: ' id-1 ',
        characterName: ' 이름 ',
        serverId: 'cain',
        serverName: '카인',
        fame: 0
      },
      {
        characterId: 'id-2',
        characterName: '둘째',
        serverId: 'future-server',
        serverName: null,
        fame: -1.5
      },
      {
        characterId: 'id-3',
        characterName: '셋째',
        serverId: 'constructor',
        serverName: null,
        fame: null
      },
      {
        characterId: 'id-4',
        characterName: '넷째',
        serverId: '__proto__',
        serverName: null,
        fame: null
      }
    ]
  })
})

test('후보가 없으면 빈 rows로 성공한다', async () => {
  const search = createNeopleCharacterSearchForTest('fake-key', {
    fetch: async () => jsonResponse({ rows: [] })
  })

  assert.deepEqual(await search(input), { rows: [] })
})

test('응답 구조나 필수 후보 값이 잘못되면 전체 응답을 거절한다', async (t) => {
  const valid = { characterId: 'id', characterName: '이름', serverId: 'cain', fame: 1 }
  const invalidBodies: Array<[string, string]> = [
    ['최상위 null', 'null'],
    ['최상위 배열', '[]'],
    ['rows 누락', '{}'],
    ['최상위 문자열', '"private upstream"'],
    ['최상위 숫자', '1'],
    ['최상위 boolean', 'false'],
    ['배열이 아닌 rows', '{"rows":{}}'],
    ['null 후보', '{"rows":[null]}'],
    ['배열 후보', '{"rows":[[]]}'],
    ['characterId 누락', JSON.stringify({ rows: [{ ...valid, characterId: undefined }] })],
    ['문자열이 아닌 characterName', JSON.stringify({ rows: [{ ...valid, characterName: 1 }] })],
    ['공백뿐인 characterId', JSON.stringify({ rows: [{ ...valid, characterId: '  ' }] })],
    ['공백뿐인 characterName', JSON.stringify({ rows: [{ ...valid, characterName: '\u00a0' }] })],
    ['빈 serverId', JSON.stringify({ rows: [{ ...valid, serverId: '' }] })],
    ['characterName 누락', JSON.stringify({ rows: [{ ...valid, characterName: undefined }] })],
    ['serverId 누락', JSON.stringify({ rows: [{ ...valid, serverId: undefined }] })],
    ['문자열이 아닌 characterId', JSON.stringify({ rows: [{ ...valid, characterId: 1 }] })],
    ['문자열이 아닌 serverId', JSON.stringify({ rows: [{ ...valid, serverId: false }] })],
    ['null characterId', JSON.stringify({ rows: [{ ...valid, characterId: null }] })],
    ['null characterName', JSON.stringify({ rows: [{ ...valid, characterName: null }] })],
    ['null serverId', JSON.stringify({ rows: [{ ...valid, serverId: null }] })],
    ['문자열 fame', JSON.stringify({ rows: [{ ...valid, fame: '0' }] })],
    ['boolean fame', JSON.stringify({ rows: [{ ...valid, fame: false }] })],
    ['객체 fame', JSON.stringify({ rows: [{ ...valid, fame: {} }] })],
    ['배열 fame', JSON.stringify({ rows: [{ ...valid, fame: [] }] })],
    [
      '유한하지 않은 fame',
      '{"rows":[{"characterId":"id","characterName":"이름","serverId":"cain","fame":1e400}]}'
    ]
  ]

  for (const [name, body] of invalidBodies) {
    await t.test(name, async () => {
      const search = createNeopleCharacterSearchForTest('fake-key', {
        fetch: async () => rawResponse(body)
      })
      await expectFailure(
        search(input),
        502,
        'NEOPLE_API_ERROR',
        '캐릭터 검색 중 오류가 발생했습니다.'
      )
    })
  }
})

test('후보 하나의 오류도 부분 rows 없이 전체 실패로 정제한다', async () => {
  const upstreamBody = {
    rows: [
      { characterId: 'valid', characterName: '정상', serverId: 'cain', fame: 1 },
      { characterId: 'invalid', characterName: '오류', serverId: 'cain', fame: '1' }
    ]
  }
  const search = createNeopleCharacterSearchForTest('fake-key', {
    fetch: async () => jsonResponse(upstreamBody)
  })

  const error = await expectFailure(
    search(input),
    502,
    'NEOPLE_API_ERROR',
    '캐릭터 검색 중 오류가 발생했습니다.'
  )
  assert.equal(JSON.stringify(error).includes('valid'), false)
})

test('HTTP 200과 rows가 있어도 식별한 공급자 code를 오류로 처리한다', async (t) => {
  const cases: Array<[string, number, string, string]> = [
    ['API000', 500, 'INTERNAL_SERVER_ERROR', '서버 오류로 검색을 처리하지 못했습니다.'],
    ['API003', 500, 'INTERNAL_SERVER_ERROR', '서버 오류로 검색을 처리하지 못했습니다.'],
    ['API004', 500, 'INTERNAL_SERVER_ERROR', '서버 오류로 검색을 처리하지 못했습니다.'],
    ['API005', 500, 'INTERNAL_SERVER_ERROR', '서버 오류로 검색을 처리하지 못했습니다.'],
    [
      'API002',
      503,
      'NEOPLE_UNAVAILABLE',
      '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    ],
    [
      'API008',
      503,
      'NEOPLE_UNAVAILABLE',
      '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    ],
    [
      'DNF980',
      503,
      'NEOPLE_UNAVAILABLE',
      '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    ],
    ['API901', 502, 'NEOPLE_API_ERROR', '캐릭터 검색 중 오류가 발생했습니다.'],
    ['DNF901', 502, 'NEOPLE_API_ERROR', '캐릭터 검색 중 오류가 발생했습니다.'],
    ['DNF000', 502, 'NEOPLE_API_ERROR', '캐릭터 검색 중 오류가 발생했습니다.'],
    ['API006', 502, 'NEOPLE_API_ERROR', '캐릭터 검색 중 오류가 발생했습니다.'],
    ['API007', 502, 'NEOPLE_API_ERROR', '캐릭터 검색 중 오류가 발생했습니다.'],
    ['API900', 502, 'NEOPLE_API_ERROR', '캐릭터 검색 중 오류가 발생했습니다.'],
    ['API999', 502, 'NEOPLE_API_ERROR', '캐릭터 검색 중 오류가 발생했습니다.'],
    ['DNF999', 502, 'NEOPLE_API_ERROR', '캐릭터 검색 중 오류가 발생했습니다.']
  ]

  for (const [upstreamCode, status, code, message] of cases) {
    await t.test(`${upstreamCode} 공급자 code`, async () => {
      const search = createNeopleCharacterSearchForTest('fake-key', {
        fetch: async () =>
          jsonResponse(
            {
              error: { code: upstreamCode, status: 503, message: 'private upstream detail' },
              rows: []
            },
            200
          )
      })
      const error = await expectFailure(search(input), status, code, message)
      const exposed = JSON.stringify(error.body)
      assert.equal(exposed.includes('private upstream detail'), false)
      assert.equal(exposed.includes('fake-key'), false)
      assert.deepEqual(Object.keys(error.body), ['error'])
      assert.deepEqual(Object.keys(error.body.error), ['code', 'message'])
    })
  }
})

test('식별한 공급자 code는 다른 HTTP 오류 상태보다 우선한다', async (t) => {
  const cases = [
    {
      upstreamCode: 'API003',
      upstreamStatus: 401,
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 오류로 검색을 처리하지 못했습니다.'
    },
    {
      upstreamCode: 'API002',
      upstreamStatus: 400,
      status: 503,
      code: 'NEOPLE_UNAVAILABLE',
      message: '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    }
  ]

  for (const item of cases) {
    await t.test(`${item.upstreamCode}와 HTTP ${item.upstreamStatus}`, async () => {
      const search = createNeopleCharacterSearchForTest('fake-key', {
        fetch: async () => jsonResponse({ error: { code: item.upstreamCode } }, item.upstreamStatus)
      })
      await expectFailure(search(input), item.status, item.code, item.message)
    })
  }
})

test('미식별, 잘못된 code와 HTTP 실패는 실제 상태의 fallback을 적용한다', async (t) => {
  const cases: Array<[string, unknown, number, number, string]> = [
    ['HTTP 503의 미식별 code', { error: { code: 'FUTURE' } }, 503, 503, 'NEOPLE_UNAVAILABLE'],
    ['HTTP 429의 미식별 code', { error: { code: 'FUTURE' } }, 429, 503, 'NEOPLE_UNAVAILABLE'],
    ['소문자로 바뀐 code', { error: { code: 'api002' } }, 400, 502, 'NEOPLE_API_ERROR'],
    ['공백이 추가된 code', { error: { code: 'API002 ' } }, 400, 502, 'NEOPLE_API_ERROR'],
    [
      'error.status는 분류에 사용하지 않음',
      { error: { status: 503 } },
      400,
      502,
      'NEOPLE_API_ERROR'
    ],
    ['rows와 함께 error가 존재', { error: null, rows: [] }, 200, 502, 'NEOPLE_API_ERROR'],
    [
      '배열 error의 code를 추정하지 않음',
      { error: ['API003'], rows: [] },
      200,
      502,
      'NEOPLE_API_ERROR'
    ],
    ['문자열 error의 code를 추정하지 않음', { error: 'API003' }, 503, 503, 'NEOPLE_UNAVAILABLE'],
    ['숫자 error.code를 변환하지 않음', { error: { code: 2 } }, 429, 503, 'NEOPLE_UNAVAILABLE'],
    ['HTTP 실패에 정상 rows가 존재', { rows: [] }, 500, 502, 'NEOPLE_API_ERROR']
  ]

  for (const [name, body, upstreamStatus, status, code] of cases) {
    await t.test(name, async () => {
      const search = createNeopleCharacterSearchForTest('fake-key', {
        fetch: async () => jsonResponse(body, upstreamStatus)
      })
      const isUnavailable = code === 'NEOPLE_UNAVAILABLE'
      const expectedMessage = isUnavailable
        ? '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
        : '캐릭터 검색 중 오류가 발생했습니다.'
      await expectFailure(search(input), status, code, expectedMessage)
    })
  }
})

test('JSON 파싱 실패는 HTTP fallback을 적용하고 본문, 통신 실패는 502로 정제한다', async () => {
  const malformed503 = createNeopleCharacterSearchForTest('fake-key', {
    fetch: async () => rawResponse('not json', 503)
  })
  await expectFailure(
    malformed503(input),
    503,
    'NEOPLE_UNAVAILABLE',
    '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  )

  const bodyFailure503 = createNeopleCharacterSearchForTest('fake-key', {
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error('private body failure'))
          }
        }),
        { status: 503 }
      )
  })
  await expectFailure(
    bodyFailure503(input),
    502,
    'NEOPLE_API_ERROR',
    '캐릭터 검색 중 오류가 발생했습니다.'
  )

  const transportFailure = createNeopleCharacterSearchForTest('fake-key', {
    fetch: async () => Promise.reject(new Error('private transport failure'))
  })
  await expectFailure(
    transportFailure(input),
    502,
    'NEOPLE_API_ERROR',
    '캐릭터 검색 중 오류가 발생했습니다.'
  )
})

test('본문 수신 완료가 정확히 5,000ms이면 취소하고 정제된 timeout을 반환한다', async () => {
  let now = 0
  let cleared = 0
  let scheduledDelay: number | undefined
  let signal: AbortSignal | undefined
  const search = createNeopleCharacterSearchForTest('fake-key', {
    fetch: async (_url, init) => {
      assert(init?.signal instanceof AbortSignal)
      signal = init.signal

      return jsonStreamResponse(
        {
          rows: [{ characterId: 'id', characterName: '이름', serverId: 'cain', fame: 1 }]
        },
        () => {
          now = 5_000
        }
      )
    },
    now: () => now,
    setTimer: (_callback, delay) => {
      scheduledDelay = delay

      return Symbol('timer')
    },
    clearTimer: () => {
      cleared++
    }
  })
  await expectFailure(
    search(input),
    504,
    'NEOPLE_TIMEOUT',
    '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.'
  )
  assert.equal(signal?.aborted, true)
  assert.equal(scheduledDelay, 5_000)
  assert.equal(cleared, 1)
})

test('본문, 응답 검증이 4,999ms에 끝나면 값을 반환하고 timer를 정리한다', async () => {
  let now = 0
  let cleared = false
  let signal: AbortSignal | undefined
  const search = createNeopleCharacterSearchForTest('fake-key', {
    fetch: async (_url, init) => {
      assert(init?.signal instanceof AbortSignal)
      signal = init.signal

      return jsonStreamResponse(
        {
          rows: [{ characterId: 'id', characterName: '이름', serverId: 'cain', fame: 1 }]
        },
        () => {
          now = 4_999
        }
      )
    },
    now: () => now,
    setTimer: () => Symbol('timer'),
    clearTimer: () => {
      cleared = true
    }
  })
  assert.deepEqual(await search(input), {
    rows: [
      { characterId: 'id', characterName: '이름', serverId: 'cain', serverName: '카인', fame: 1 }
    ]
  })
  assert.equal(signal?.aborted, false)
  assert.equal(cleared, true)
})

test('본문 수신 뒤 응답 처리 중 deadline에 도달하면 성공 결과를 거절한다', async () => {
  // Response 속성을 바꾸지 않고 처리 동안 단조 clock이 진행하는 경계만 제어한다.
  const instants = [0, 4_999, 4_999, 5_000]
  let observed = 0
  const search = createNeopleCharacterSearchForTest('fake-key', {
    fetch: async () =>
      jsonResponse({
        rows: [{ characterId: 'id', characterName: '이름', serverId: 'cain', fame: 1 }]
      }),
    now: () => {
      const index = Math.min(observed++, instants.length - 1)

      return instants[index]!
    },
    setTimer: () => Symbol('timer'),
    clearTimer: () => undefined
  })
  await expectFailure(
    search(input),
    504,
    'NEOPLE_TIMEOUT',
    '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.'
  )
})

test('5,000ms에 수신된 공급자 오류 code는 이미 도달한 deadline을 덮어쓰지 않는다', async () => {
  let now = 0
  const search = createNeopleCharacterSearchForTest('fake-key', {
    fetch: async () =>
      jsonStreamResponse({ error: { code: 'API003', message: 'private detail' } }, () => {
        now = 5_000
      }),
    now: () => now,
    setTimer: () => Symbol('timer'),
    clearTimer: () => undefined
  })
  await expectFailure(
    search(input),
    504,
    'NEOPLE_TIMEOUT',
    '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.'
  )
})

test('deadline timer는 진행 중인 transport를 취소하고 재시도하지 않는다', async () => {
  let callback: (() => void) | undefined
  let signal: AbortSignal | undefined
  let calls = 0
  let cleared = false
  const search = createNeopleCharacterSearchForTest('fake-key', {
    fetch: async (_url, init) => {
      calls++
      assert(init?.signal instanceof AbortSignal)
      signal = init.signal

      return new Promise<Response>((_resolve, reject) => {
        signal!.addEventListener(
          'abort',
          () => reject(new DOMException('요청 취소', 'AbortError')),
          { once: true }
        )
      })
    },
    now: () => 0,
    setTimer: (handler) => {
      callback = handler

      return Symbol('timer')
    },
    clearTimer: () => {
      cleared = true
    }
  })
  const pending = search(input)
  assert(callback)
  assert.equal(signal?.aborted, false)
  callback()
  await expectFailure(
    pending,
    504,
    'NEOPLE_TIMEOUT',
    '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.'
  )
  assert.equal(signal?.aborted, true)
  assert.equal(cleared, true)
  assert.equal(calls, 1)
})

test('동시 검색은 controller, timer, 결과를 공유하지 않는다', async () => {
  const timers: Array<{ callback: () => void; cleared: boolean }> = []
  let calls = 0
  const search = createNeopleCharacterSearchForTest('fake-key', {
    fetch: async (request, init) => {
      calls += 1
      const name = new URL(request).searchParams.get('characterName')
      const isFastSearch = name === '빠른검색'
      if (isFastSearch) {
        return jsonResponse({
          rows: [{ characterId: 'fast', characterName: name, serverId: 'cain', fame: 0 }]
        })
      }

      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('요청 취소', 'AbortError')),
          { once: true }
        )
      })
    },
    now: () => 0,
    setTimer: (callback) => {
      const timer = { callback, cleared: false }
      timers.push(timer)

      return timer
    },
    clearTimer: (timer) => {
      ;(timer as { cleared: boolean }).cleared = true
    }
  })

  const slow = search({ ...input, characterName: '느린검색' })
  const fast = search({ ...input, characterName: '빠른검색' })
  assert.deepEqual(await fast, {
    rows: [
      {
        characterId: 'fast',
        characterName: '빠른검색',
        serverId: 'cain',
        serverName: '카인',
        fame: 0
      }
    ]
  })
  assert.equal(timers[1]?.cleared, true)
  assert.equal(timers[0]?.cleared, false)
  timers[0]?.callback()
  await expectFailure(
    slow,
    504,
    'NEOPLE_TIMEOUT',
    '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.'
  )
  assert.equal(calls, 2)
})
