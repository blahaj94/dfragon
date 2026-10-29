import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import type {
  CharacterDetailSection,
  CharacterPayloads
} from '../src/characters/details/sections.js'
import { CharacterDetailFailure, characterDetailFailure } from '../src/characters/details/errors.js'
import {
  createNeopleCharacterDetailsForTest,
  validateCharacterPayload
} from '../src/characters/details/neople.js'
import { parseCharacterIdentity } from '../src/characters/details/service.js'
import { NeopleSearchFailure } from '../src/errors/neople-search.js'

const identity = { serverId: 'siroco', characterId: 'fixture-character' }
const ignoreStage = () => undefined
const basic = { ...identity, characterName: '테스트 캐릭터' }

test('상세 입력은 지원 서버, 안전한 ID만 허용하고 query와 경로 주입을 거절한다', () => {
  assert.deepEqual(
    parseCharacterIdentity(
      identity.serverId,
      identity.characterId,
      '/characters/siroco/fixture-character'
    ),
    identity
  )
  for (const [server, character, url] of [
    ['all', identity.characterId, '/characters/all/id'],
    ['siroco', '../id', '/characters/siroco/../id'],
    ['siroco', ' ', '/characters/siroco/%20'],
    ['siroco', identity.characterId, '/characters/siroco/id?apikey=untrusted']
  ]) {
    assert.throws(
      () => parseCharacterIdentity(server, character, url!),
      (error: unknown) => error instanceof CharacterDetailFailure && error.status === 400
    )
  }
})

test('공급자 원문의 시즌 옵션과 미장착 null을 보존하고 누락, 잘못된 envelope를 거절한다', () => {
  const payload = { ...basic, creature: null, futureOption: { rate: '48.3%', value: 0 } }
  assert.deepEqual(validateCharacterPayload(payload, identity, 'creature'), payload)
  for (const body of [
    null,
    [],
    basic,
    { ...payload, characterId: 'another' },
    { ...payload, serverId: 'cain' },
    { ...payload, creature: 'invalid' }
  ]) {
    assert.throws(
      () => validateCharacterPayload(body, identity, 'creature'),
      (error: unknown) =>
        error instanceof CharacterDetailFailure &&
        error.status === 502 &&
        error.body.error.code === 'NEOPLE_API_ERROR'
    )
  }
})

test('상세 오류로 바꾼 검색 오류는 같은 종류의 상세 문구를 쓰고 검색 query 오류는 내부 오류로 반환한다', () => {
  for (const [kind, status, code] of [
    ['query', 500, 'INTERNAL_SERVER_ERROR'],
    ['internal', 500, 'INTERNAL_SERVER_ERROR'],
    ['api', 502, 'NEOPLE_API_ERROR'],
    ['unavailable', 503, 'NEOPLE_UNAVAILABLE'],
    ['timeout', 504, 'NEOPLE_TIMEOUT']
  ] as const) {
    const failure = characterDetailFailure(new NeopleSearchFailure(kind))
    assert(failure instanceof CharacterDetailFailure, kind)
    assert.equal(failure.status, status, kind)
    assert.equal(failure.body.error.code, code, kind)
    assert.match(failure.body.error.message, /캐릭터 정보/, kind)
  }
})

test('공급자 알려진 code를 우선 분류하고 기본 조회 실패는 정제 오류로 반환하며 재시도하지 않는다', async () => {
  for (const [status, body, expected, code] of [
    [
      503,
      { error: { code: 'API901', message: 'sensitive upstream detail' } },
      502,
      'NEOPLE_API_ERROR'
    ],
    [401, { error: { code: 'API003' } }, 500, 'INTERNAL_SERVER_ERROR'],
    [400, { error: { code: 'API002' } }, 503, 'NEOPLE_UNAVAILABLE'],
    [429, { error: { code: 'FUTURE' } }, 503, 'NEOPLE_UNAVAILABLE'],
    [503, 'invalid JSON', 503, 'NEOPLE_UNAVAILABLE'],
    [504, 'invalid JSON', 502, 'NEOPLE_API_ERROR'],
    [502, {}, 502, 'NEOPLE_API_ERROR'],
    [200, 'invalid JSON', 502, 'NEOPLE_API_ERROR'],
    [200, { ...basic, characterId: 'wrong' }, 502, 'NEOPLE_API_ERROR']
  ] as const) {
    let calls = 0
    const adapter = createNeopleCharacterDetailsForTest('fake-key', {
      fetch: async (request) => {
        calls++
        assert.equal(request.headers.get('apikey'), 'fake-key')

        return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
      }
    })
    await assert.rejects(
      adapter(identity, new AbortController().signal, ignoreStage),
      (error: unknown) => {
        assert(error instanceof CharacterDetailFailure)
        assert.equal(error.status, expected, `${status} ${JSON.stringify(body)}`)
        assert.equal(error.body.error.code, code)
        assert.equal(JSON.stringify(error.body).includes('sensitive'), false)

        return true
      }
    )
    assert.equal(calls, 1)
  }
})

test('연결 오류는 재시도하지 않고 원문 없이 공급자 오류로 반환한다', async () => {
  let calls = 0
  const adapter = createNeopleCharacterDetailsForTest('fake-key', {
    fetch: async () => {
      calls++
      // undici가 연결 실패에 쓰는 오류와 같은 이름, 문구다.
      throw new TypeError('fetch failed', { cause: new Error('sensitive socket detail') })
    }
  })
  await assert.rejects(
    adapter(identity, new AbortController().signal, ignoreStage),
    (error: unknown) => {
      assert(error instanceof CharacterDetailFailure)
      assert.equal(error.status, 502)
      assert.equal(JSON.stringify(error.body).includes('sensitive'), false)

      return true
    }
  )
  assert.equal(calls, 1)
})

test('공급자가 header나 body를 보내지 않으면 HTTP client timeout 뒤 504로 반환하고 transport를 취소한다', {
  timeout: 2_000
}, async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const neverSettles = (signal: AbortSignal) =>
    new Promise<never>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
  for (const stall of ['header', 'body'] as const) {
    let signal: AbortSignal | undefined
    let markWaiting!: () => void
    const waiting = new Promise<void>((resolve) => {
      markWaiting = resolve
    })
    const adapter = createNeopleCharacterDetailsForTest('fake-key', {
      fetch: async (request) => {
        signal = request.signal
        if (stall === 'header') {
          markWaiting()

          return neverSettles(request.signal)
        }
        const pull = () => {
          markWaiting()

          return neverSettles(request.signal)
        }

        return new Response(new ReadableStream({ pull }, { highWaterMark: 0 }))
      }
    })
    const pending = assert.rejects(
      adapter(identity, new AbortController().signal, ignoreStage),
      (error: unknown) => error instanceof CharacterDetailFailure && error.status === 504,
      stall
    )
    // ky는 fetch 호출, body 읽기 직전에 timer를 걸기 때문에 대기가 시작되면 timer가 등록돼 있다.
    await waiting
    // ky 기본 timeout 값을 고정하지 않도록 어떤 기본값보다도 넉넉히 진행한다.
    t.mock.timers.tick(60_000)
    await pending
    assert.equal(signal?.aborted, true, stall)
  }
})

test('실제 HTTP transport는 redirect를 따라가지 않고 공급자 오류로 반환한다', async () => {
  let requests = 0
  const server = createServer((_request, response) => {
    requests++
    response.writeHead(302, { location: '/unexpected' }).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  try {
    const adapter = createNeopleCharacterDetailsForTest('fake-key', {
      origin: `http://127.0.0.1:${address.port}`
    })
    await assert.rejects(
      adapter(identity, new AbortController().signal, ignoreStage),
      (error: unknown) => error instanceof CharacterDetailFailure && error.status === 502
    )
    assert.equal(requests, 1)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test('기본 응답 뒤 취소되면 남은 섹션은 전송하지 않는다', async () => {
  const controller = new AbortController()
  let started!: () => void
  const entered = new Promise<void>((resolve) => {
    started = resolve
  })
  let finish!: () => void
  const late = new Promise<void>((resolve) => {
    finish = resolve
  })
  let calls = 0
  const adapter = createNeopleCharacterDetailsForTest('fixture-key', {
    fetch: async () => {
      calls++
      started()
      await late

      return Response.json(basic)
    }
  })
  const pending = adapter(identity, controller.signal, ignoreStage)
  const rejected = assert.rejects(pending, { status: 500 })
  await entered
  controller.abort()
  finish()
  await rejected
  assert.equal(calls, 1)
})

test('이미 취소된 요청은 기본 조회도 전송하지 않는다', async () => {
  const controller = new AbortController()
  controller.abort()
  let calls = 0
  const adapter = createNeopleCharacterDetailsForTest('fixture-key', {
    fetch: async () => {
      calls++

      return Response.json(basic)
    }
  })
  await assert.rejects(adapter(identity, controller.signal, ignoreStage), { status: 500 })
  assert.equal(calls, 0)
})

test('상세 ID는 대소문자와 ASCII 경계 1~256자를 보존하고 빈 값, 257자, 비ASCII를 거절한다', () => {
  for (const characterId of ['A', 'Mixed_ID-Case', 'x'.repeat(256)]) {
    assert.deepEqual(
      parseCharacterIdentity('siroco', characterId, '/characters/siroco/' + characterId),
      {
        serverId: 'siroco',
        characterId
      }
    )
  }
  for (const characterId of ['', 'x'.repeat(257), '캐릭터', 'id/path', 'id%2Fpath']) {
    assert.throws(
      () => parseCharacterIdentity('siroco', characterId, '/characters/siroco/' + characterId),
      (error: unknown) =>
        error instanceof CharacterDetailFailure &&
        error.status === 400 &&
        error.body.error.code === 'INVALID_CHARACTER_QUERY'
    )
  }
})

const completePayloads: CharacterPayloads = {
  basic: { ...basic, level: 115, jobId: 'job', fame: 0, adventureName: '합성 모험단' },
  status: {
    ...basic,
    status: [
      { name: '힘', value: 0 },
      { name: '공격 속도', value: '48.3%' }
    ],
    buff: null
  },
  equipment: {
    ...basic,
    equipment: [{ itemId: 'weapon', slotId: 'WEAPON', tune: { level: 3 } }],
    setItemInfo: []
  },
  avatar: { ...basic, avatar: [] },
  creature: { ...basic, creature: null },
  oath: { ...basic, oath: { info: null, crystal: [], blessing: { futureOption: 0 } } },
  mist_assimilation: { ...basic, mistAssimilation: { level: 0 } },
  skill_style: {
    ...basic,
    skill: {
      hash: 'fixture-hash',
      style: { active: [], passive: [], chain: { resetTime: 0, skills: [null, null] } }
    }
  },
  buff_equipment: {
    ...basic,
    skill: { buff: { skillInfo: { skillId: 'buff', level: 10 }, equipment: [] } }
  },
  buff_avatar: { ...basic, skill: { buff: { avatar: null } } },
  buff_creature: { ...basic, skill: { buff: { creature: [] } } }
}
const sectionsByPath = new Map<string, CharacterDetailSection>([
  ['', 'basic'],
  ['/status', 'status'],
  ['/equip/equipment', 'equipment'],
  ['/equip/avatar', 'avatar'],
  ['/equip/creature', 'creature'],
  ['/equip/oath', 'oath'],
  ['/equip/mist-assimilation', 'mist_assimilation'],
  ['/skill/style', 'skill_style'],
  ['/skill/buff/equip/equipment', 'buff_equipment'],
  ['/skill/buff/equip/avatar', 'buff_avatar'],
  ['/skill/buff/equip/creature', 'buff_creature']
])

test('기본 식별 응답을 확인한 뒤 나머지 10개를 동시에 시작해 11개 원문, 옵션, null을 모두 반환한다', {
  timeout: 2000
}, async (t) => {
  let basicStarted!: () => void, finishBasic!: () => void
  const enteredBasic = new Promise<void>((resolve) => {
    basicStarted = resolve
  })
  const basicBody = new Promise<void>((resolve) => {
    finishBasic = resolve
  })
  let allSectionsStarted!: () => void, finishSections!: () => void
  const enteredAllSections = new Promise<void>((resolve) => {
    allSectionsStarted = resolve
  })
  const sectionBodies = new Promise<void>((resolve) => {
    finishSections = resolve
  })
  t.after(() => {
    finishBasic()
    finishSections()
  })
  const requested: string[] = []
  let active = 0,
    peak = 0
  const prefix = '/df/servers/siroco/characters/fixture-character'
  const adapter = createNeopleCharacterDetailsForTest('fixture-key', {
    fetch: async (request) => {
      const url = new URL(request.url)
      assert(url.pathname.startsWith(prefix))
      assert.equal(url.search, '')
      assert.equal(request.headers.get('apikey'), 'fixture-key')
      assert.equal(request.redirect, 'error')
      const suffix = url.pathname.slice(prefix.length)
      const section = sectionsByPath.get(suffix)
      assert(section)
      requested.push(suffix)
      active++
      peak = Math.max(peak, active)
      if (section === 'basic') {
        basicStarted()
        await basicBody
      } else {
        // 예전 3개씩 조회에서는 응답 전에 10개가 모두 시작되지 않아 timeout으로 실패한다.
        if (active === 10) {
          allSectionsStarted()
        }
        await sectionBodies
      }
      active--

      return Response.json(completePayloads[section])
    }
  })
  const pending = adapter(identity, new AbortController().signal, ignoreStage)
  await enteredBasic
  assert.deepEqual(requested, [''])
  finishBasic()
  await enteredAllSections
  assert.equal(active, 10)
  finishSections()

  assert.deepEqual(await pending, completePayloads)
  assert.deepEqual(requested.sort(), [...sectionsByPath.keys()].sort())
  assert.equal(peak, 10)
  assert.equal(active, 0)
})

test('각 상세 섹션의 필수 최상위 envelope를 검사하되 미장착 null은 유효하게 받는다', async (t) => {
  for (const [section, fields] of [
    ['status', ['status', 'buff']],
    ['equipment', ['equipment', 'setItemInfo']],
    ['avatar', ['avatar']],
    ['creature', ['creature']],
    ['oath', ['oath']],
    ['mist_assimilation', ['mistAssimilation']],
    ['skill_style', ['skill']],
    ['buff_equipment', ['skill']],
    ['buff_avatar', ['skill']],
    ['buff_creature', ['skill']]
  ] as const) {
    await t.test(`${section} 필수 최상위 필드`, () => {
      const original = structuredClone(completePayloads[section])
      assert.deepEqual(
        validateCharacterPayload(original, identity, section),
        completePayloads[section]
      )
      for (const field of fields) {
        const absent = structuredClone(original)
        delete absent[field]
        assert.throws(
          () => validateCharacterPayload(absent, identity, section),
          (error: unknown) =>
            error instanceof CharacterDetailFailure &&
            error.status === 502 &&
            error.body.error.code === 'NEOPLE_API_ERROR'
        )
        const empty = { ...original, [field]: null }
        assert.deepEqual(validateCharacterPayload(empty, identity, section), empty)
      }
      assert.deepEqual(original, completePayloads[section])
    })
  }
})

test('기본 응답 뒤 한 섹션이 실패하면 부분 성공을 반환하지 않는다', async () => {
  const paths: string[] = []
  const adapter = createNeopleCharacterDetailsForTest('fixture-key', {
    fetch: async (request) => {
      const path = new URL(request.url).pathname
      paths.push(path)
      if (path.endsWith('/fixture-character')) {
        return Response.json(basic)
      }

      return Response.json({
        error: { code: 'API901', message: 'private section failure' }
      })
    }
  })

  await assert.rejects(
    adapter(identity, new AbortController().signal, ignoreStage),
    (error: unknown) => {
      assert(error instanceof CharacterDetailFailure)
      assert.equal(error.status, 502)
      assert.deepEqual(error.body, {
        error: { code: 'NEOPLE_API_ERROR', message: '캐릭터 정보 조회 중 오류가 발생했습니다.' }
      })

      return true
    }
  )
  assert.equal(paths.length, 11)
  assert.equal(new Set(paths).size, paths.length)
})

test('기본 응답 뒤 한 섹션이 실패하면 아직 진행 중인 다른 섹션 요청을 취소한다', {
  timeout: 2_000
}, async () => {
  const pendingSignals: AbortSignal[] = []
  const adapter = createNeopleCharacterDetailsForTest('fixture-key', {
    fetch: async (request) => {
      const path = new URL(request.url).pathname
      if (path.endsWith('/fixture-character')) {
        return Response.json(basic)
      }

      if (path.endsWith('/equip/equipment')) {
        return Response.json({ error: { code: 'API901', message: 'private section failure' } })
      }

      pendingSignals.push(request.signal)

      return new Promise<Response>((_resolve, reject) => {
        request.signal.addEventListener(
          'abort',
          () => reject(new DOMException('요청 취소', 'AbortError')),
          { once: true }
        )
      })
    }
  })

  await assert.rejects(adapter(identity, new AbortController().signal, ignoreStage), {
    status: 502
  })
  // 실패보다 늦게 시작하는 섹션은 transport를 열지 않으므로 진행 중이던 요청 수는 실행 순서에 따라 다르다.
  assert(pendingSignals.length > 0)
  assert(pendingSignals.every((signal) => signal.aborted))
})
