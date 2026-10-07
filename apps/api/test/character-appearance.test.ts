import assert from 'node:assert/strict'
import { request } from 'node:http'
import type { OutgoingHttpHeaders } from 'node:http'
import test from 'node:test'
import type { TestContext } from 'node:test'
import type { INestApplication } from '@nestjs/common'
import { createApiHttpApp } from '../src/http.js'
import { createNeopleCharacterAppearanceForTest } from '../src/characters/appearance/neople.js'
import type { FetchCharacterAppearance } from '../src/characters/appearance/neople.js'
import { createCharacterAppearanceService } from '../src/characters/appearance/service.js'
import { projectCharacterAppearance } from '../src/characters/appearance/project.js'
import { CharacterDetailFailure } from '../src/characters/details/errors.js'
import {
  appearance,
  identity,
  payload,
  AppearanceClock,
  completionSignal
} from './character-appearance-fixtures.js'

const path = `/characters/${identity.serverId}/${identity.characterId}/appearance`
const queryError = {
  error: { code: 'INVALID_CHARACTER_QUERY', message: '캐릭터 조회 조건을 확인해 주세요.' }
}
const apiError = {
  error: { code: 'NEOPLE_API_ERROR', message: '캐릭터 정보 조회 중 오류가 발생했습니다.' }
}

async function startApp(
  t: TestContext,
  fetchAppearance: FetchCharacterAppearance,
  clock = new AppearanceClock()
): Promise<{ app: INestApplication; origin: string }> {
  const app = await createApiHttpApp(
    { searchCharacters: async () => ({ rows: [] }), clock },
    undefined,
    undefined,
    undefined,
    undefined,
    { fetchAppearance, clock }
  )
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  return { app, origin }
}

test('appearance는 equip/avatar 한 번으로 외형 식별 필드만 반환하고 원문 슬롯과 clone을 보존한다', async (t) => {
  const calls: Array<{ url: URL; init: RequestInit | undefined }> = []
  const adapter = createNeopleCharacterAppearanceForTest('synthetic-appearance-key', {
    fetch: async (input, init) => {
      calls.push({ url: new URL(String(input)), init })

      return Response.json(payload())
    }
  })
  const { origin } = await startApp(t, adapter)
  const response = await fetch(origin + path)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), appearance)
  assert.equal(calls.length, 1)
  const call = calls[0]!
  assert.equal(call.url.origin, 'https://api.neople.co.kr')
  assert.equal(call.url.pathname, '/df/servers/siroco/characters/synthetic-character/equip/avatar')
  assert.equal(call.url.search, '')
  assert.equal(call.init?.method, 'GET')
  assert.equal(call.init?.redirect, 'error')
  assert.deepEqual(call.init?.headers, { apikey: 'synthetic-appearance-key' })
})

test('미장착 avatar:null과 누락, null, 명시된 null pair clone만 빈 외형으로 일관화한다', () => {
  assert.deepEqual(projectCharacterAppearance(identity, { ...payload(), avatar: null }), {
    ...appearance,
    avatar: []
  })
  for (const clone of [undefined, null, { itemId: null, itemName: null }]) {
    const avatar = [{ ...appearance.avatar[0], clone }]
    assert.deepEqual(
      projectCharacterAppearance(identity, { ...payload(), avatar }).avatar[0]?.clone,
      { itemId: null, itemName: null }
    )
  }
})

test('불완전한 외형 응답은 부분 배열이나 상세 정보로 대체하지 않고 전체 실패한다', async (t) => {
  const invalid: Array<[string, unknown]> = [
    ['다른 identity', { ...payload(), characterId: 'other' }],
    ['다른 server', { ...payload(), serverId: 'cain' }],
    ['빈 캐릭터명', { ...payload(), characterName: ' ' }],
    ['직업 누락', { ...payload(), jobName: undefined }],
    ['직업 객체', { ...payload(), jobGrowName: {} }],
    ['avatar 누락', { ...payload(), avatar: undefined }],
    ['avatar 객체', { ...payload(), avatar: {} }],
    ['중복 슬롯', { ...payload(), avatar: [appearance.avatar[0], appearance.avatar[0]] }],
    ['슬롯 누락', { ...payload(), avatar: [{ itemId: 'id', itemName: '이름' }] }],
    ['빈 아이템명', { ...payload(), avatar: [{ ...appearance.avatar[0], itemName: '' }] }],
    [
      'clone 반쪽 null',
      {
        ...payload(),
        avatar: [{ ...appearance.avatar[0], clone: { itemId: 'id', itemName: null } }]
      }
    ],
    [
      'clone 반쪽 누락',
      { ...payload(), avatar: [{ ...appearance.avatar[0], clone: { itemId: null } }] }
    ],
    ['clone 객체 아님', { ...payload(), avatar: [{ ...appearance.avatar[0], clone: [] }] }]
  ]
  let upstream: unknown
  let calls = 0
  const adapter = createNeopleCharacterAppearanceForTest('synthetic-key', {
    fetch: async () => {
      calls++

      return Response.json(upstream)
    }
  })
  const { origin } = await startApp(t, adapter)
  for (const [name, body] of invalid) {
    await t.test(name, async () => {
      upstream = body
      const response = await fetch(origin + path)
      assert.equal(response.status, 502)
      assert.deepEqual(await response.json(), apiError)
    })
  }
  assert.equal(calls, invalid.length)
})

function rawGet(
  url: string,
  headers: OutgoingHttpHeaders
): Promise<{ status: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', headers }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        body += chunk
      })
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('error', reject)
    req.end('x')
  })
}

test('지원 서버와 ID를 검사하고 query, HEAD, framed GET body를 공급자 호출 전에 거절한다', async (t) => {
  let calls = 0
  const { origin } = await startApp(t, async () => {
    calls++

    return appearance
  })
  for (const invalid of [
    path + '?',
    path + '?zoom=1',
    path.replace('siroco', 'all'),
    path.replace('synthetic-character', '%2Fescape'),
    path.replace('synthetic-character', 'x'.repeat(257)),
    path.replace('synthetic-character', 'safe-id%0A'),
    path.replace('synthetic-character', 'safe-id%0D'),
    path.replace('synthetic-character', 'safe-id%E2%80%A8')
  ]) {
    const response = await fetch(origin + invalid)
    assert.equal(response.status, 400, invalid)
    assert.deepEqual(await response.json(), queryError)
  }
  assert.equal((await fetch(origin + path, { method: 'HEAD' })).status, 400)
  for (const headers of [{ 'content-length': '1' }, { 'transfer-encoding': 'chunked' }]) {
    const response = await rawGet(origin + path, headers)
    assert.equal(response.status, 400)
    assert.deepEqual(JSON.parse(response.body), queryError)
  }
  assert.equal(calls, 0)
})

test('appearance만 IP당 64회를 허용하고 실패도 소비하며 기존 검색 10회 한도와 분리된다', async (t) => {
  const clock = new AppearanceClock()
  let calls = 0
  const { origin } = await startApp(
    t,
    async () => {
      calls++
      if (calls === 1) {
        throw new CharacterDetailFailure('api')
      }

      return appearance
    },
    clock
  )
  for (let index = 0; index < 64; index++) {
    const response = await fetch(origin + path)
    assert.equal(response.status, index === 0 ? 502 : 200)
    await response.arrayBuffer()
  }
  const limited = await fetch(origin + path)
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get('retry-after'), '60')
  assert.deepEqual(await limited.json(), {
    error: {
      code: 'CHARACTER_RATE_LIMITED',
      message: '캐릭터 조회 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    }
  })
  assert.equal(calls, 64)
  for (let index = 0; index < 10; index++) {
    const response = await fetch(origin + '/characters?characterName=ab')
    assert.equal(response.status, 200)
    await response.arrayBuffer()
  }
  assert.equal((await fetch(origin + '/characters?characterName=ab')).status, 429)
  clock.advance(59_999)
  assert.equal((await fetch(origin + path)).headers.get('retry-after'), '1')
  clock.advance(60_000)
  assert.equal((await fetch(origin + path)).status, 200)
  assert.equal(calls, 65)
})

test('종료는 appearance의 admission timer와 진행 중 작업을 정리하고 재시작을 거절한다', async () => {
  const clock = new AppearanceClock()
  let signal: AbortSignal | undefined
  const started = completionSignal()
  const service = createCharacterAppearanceService({
    clock,
    fetchAppearance: async (_identity, currentSignal) => {
      signal = currentSignal
      started.resolve()
      await new Promise<void>((_resolve, reject) =>
        currentSignal.addEventListener('abort', () => reject(new Error('synthetic-canceled')), {
          once: true
        })
      )

      return appearance
    }
  })
  const pending = service.get('192.0.2.1', identity, new AbortController().signal)
  const rejected = assert.rejects(pending, { status: 500 })
  await started.promise
  assert.equal(clock.timerCount, 1)
  await service.onModuleDestroy()
  await rejected
  assert.equal(signal?.aborted, true)
  assert.equal(clock.timerCount, 0)
  await assert.rejects(service.get('192.0.2.1', identity, new AbortController().signal), {
    status: 500
  })
})
