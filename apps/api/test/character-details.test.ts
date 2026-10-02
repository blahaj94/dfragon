import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { NeopleBudget } from '../src/characters/provider-budget.js'
import type {
  CharacterDetailSection,
  CharacterPayloads
} from '../src/characters/details/sections.js'
import { CharacterDetailFailure } from '../src/characters/details/errors.js'
import {
  createNeopleCharacterDetailsForTest,
  validateCharacterPayload
} from '../src/characters/details/neople.js'
import { parseCharacterIdentity } from '../src/characters/details/service.js'

const identity = { serverId: 'siroco', characterId: 'fixture-character' }
const basic = { ...identity, characterName: '테스트 캐릭터' }

test('상세 입력은 지원 서버·안전한 ID만 허용하고 query와 경로 주입을 거절한다', () => {
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

test('공급자 원문의 시즌 옵션과 미장착 null을 보존하고 누락·잘못된 envelope를 거절한다', () => {
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

test('공급자 알려진 code를 우선 분류하고 기본 조회 실패는 정제 오류로 반환하며 재시도하지 않는다', async () => {
  for (const [status, body, expected] of [
    [503, { error: { code: 'API901', message: 'sensitive upstream detail' } }, 502],
    [401, { error: { code: 'API003' } }, 500],
    [503, 'invalid JSON', 503],
    [200, { ...basic, characterId: 'wrong' }, 502]
  ] as const) {
    let calls = 0
    const adapter = createNeopleCharacterDetailsForTest('fake-key', {
      fetch: async (_url, init) => {
        calls++
        assert.equal(new Headers(init?.headers).get('apikey'), 'fake-key')

        return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
      }
    })
    await assert.rejects(adapter(identity, new AbortController().signal), (error: unknown) => {
      assert(error instanceof CharacterDetailFailure)
      assert.equal(error.status, expected)
      assert.equal(JSON.stringify(error.body).includes('sensitive'), false)

      return true
    })
    assert.equal(calls, 1)
  }
})

test('실제 HTTP transport는 미완성 body의 전체 제한 시간을 지키고 redirect를 따라가지 않는다', async () => {
  let mode = 'stall'
  let requests = 0
  const server = createServer((_request, response) => {
    requests++
    if (mode === 'redirect') {
      response.writeHead(302, { location: '/unexpected' }).end()
    } else {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.write('{')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  try {
    const adapter = createNeopleCharacterDetailsForTest('fake-key', {
      origin: `http://127.0.0.1:${address.port}`,
      timeoutMs: 150
    })
    await assert.rejects(
      adapter(identity, new AbortController().signal),
      (error: unknown) => error instanceof CharacterDetailFailure && error.status === 504
    )
    mode = 'redirect'
    await assert.rejects(
      adapter(identity, new AbortController().signal),
      (error: unknown) => error instanceof CharacterDetailFailure && error.status === 502
    )
    assert.equal(requests, 2)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test('기본 응답 뒤 취소되면 남은 섹션은 전송하지 않고 공급자 호출 예산도 소비하지 않는다', async () => {
  const budget = new NeopleBudget(() => 0)
  // 600회 예산에 기본 조회와 정상 후속 transport 한 번만 남겨 둔다.
  for (let count = 0; count < 598; count++) {
    await budget.run(async () => undefined)
  }
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
    budget,
    fetch: async () => {
      calls++
      started()
      await late

      return Response.json(basic)
    }
  })
  const pending = adapter(identity, controller.signal)
  const rejected = assert.rejects(pending, { status: 500 })
  await entered
  controller.abort()
  finish()
  await rejected
  assert.equal(calls, 1)
  assert.equal(await budget.run(async () => '정상 transport'), '정상 transport')
  await assert.rejects(
    budget.run(async () => '예산 초과 transport'),
    { status: 429 }
  )
})

test('상세 ID는 대소문자와 ASCII 경계 1~256자를 보존하고 빈 값·257자·비ASCII를 거절한다', () => {
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

test(
  '기본 식별 응답을 확인한 뒤 최대 3개씩 조회해 11개 원문·옵션·null을 모두 반환한다',
  { timeout: 2000 },
  async (t) => {
    let basicStarted!: () => void, finishBasic!: () => void
    const enteredBasic = new Promise<void>((resolve) => {
      basicStarted = resolve
    })
    const basicBody = new Promise<void>((resolve) => {
      finishBasic = resolve
    })
    let sectionStarted!: () => void, finishSections!: () => void
    const enteredSection = new Promise<void>((resolve) => {
      sectionStarted = resolve
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
      fetch: async (input, options) => {
        const url = new URL(String(input))
        assert(url.pathname.startsWith(prefix))
        assert.equal(url.search, '')
        assert.equal(new Headers(options?.headers).get('apikey'), 'fixture-key')
        assert.equal(options?.redirect, 'error')
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
          sectionStarted()
          await sectionBodies
        }
        active--

        return Response.json(completePayloads[section])
      }
    })
    const pending = adapter(identity, new AbortController().signal)
    await enteredBasic
    assert.deepEqual(requested, [''])
    finishBasic()
    await enteredSection
    assert(active > 0 && active <= 3)
    finishSections()

    assert.deepEqual(await pending, completePayloads)
    assert.deepEqual(requested.sort(), [...sectionsByPath.keys()].sort())
    assert(peak > 0 && peak <= 3)
    assert.equal(active, 0)
  }
)

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

test('기본 응답 뒤 한 섹션이 실패하면 부분 성공을 반환하거나 다음 그룹을 조회하지 않는다', async () => {
  const paths: string[] = []
  const adapter = createNeopleCharacterDetailsForTest('fixture-key', {
    fetch: async (input) => {
      const path = new URL(String(input)).pathname
      paths.push(path)
      if (path.endsWith('/fixture-character')) {
        return Response.json(basic)
      }

      return Response.json({
        error: { code: 'API901', message: 'private section failure' }
      })
    }
  })

  await assert.rejects(adapter(identity, new AbortController().signal), (error: unknown) => {
    assert(error instanceof CharacterDetailFailure)
    assert.equal(error.status, 502)
    assert.deepEqual(error.body, {
      error: { code: 'NEOPLE_API_ERROR', message: '캐릭터 정보 조회 중 오류가 발생했습니다.' }
    })

    return true
  })
  assert(paths.length >= 2 && paths.length <= 4)
  assert.equal(new Set(paths).size, paths.length)
})
