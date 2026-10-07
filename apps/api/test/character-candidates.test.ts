import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { createNeopleCharacterSearchForTest } from '../src/characters/neople-character-search.js'
import type { SearchClock } from '../src/characters/types.js'
import { createApiHttpApp } from '../src/http.js'
import type { NeopleCharacterSearchTestDependencies } from '../src/types/neople-character-search.js'

const characterName = '후보이름'
const candidatePath = `/characters/candidates?characterName=${encodeURIComponent(characterName)}`
const queryError = {
  error: { code: 'INVALID_SEARCH_QUERY', message: '검색 조건을 확인해 주세요.' }
}
const providerError = {
  error: { code: 'NEOPLE_API_ERROR', message: '캐릭터 검색 중 오류가 발생했습니다.' }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

async function startApp(
  t: TestContext,
  dependencies: NeopleCharacterSearchTestDependencies,
  clock?: SearchClock
): Promise<string> {
  const searchCharacters = createNeopleCharacterSearchForTest(
    'synthetic-candidates-key',
    dependencies
  )
  const app = await createApiHttpApp({
    searchCharacters,
    clock
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')

  return app.getUrl()
}

test('후보는 명성 내림차순, 동률과 null의 공급자 순서로 정렬하고 이미지 URL을 제공한다', async (t) => {
  const origin = await startApp(t, {
    fetch: async () =>
      jsonResponse({
        rows: [
          { characterId: 'null-first', characterName, serverId: 'siroco', fame: null },
          { characterId: 'zero', characterName, serverId: 'cain', fame: 0 },
          { characterId: 'tie-first', characterName, serverId: 'anton', fame: 50000 },
          { characterId: 'omitted', characterName, serverId: 'bakal' },
          {
            characterId: 'top_A-1',
            characterName,
            serverId: 'hilder',
            serverName: '잘못된 공급자 서버명',
            fame: 60000,
            imageUrl: 'https://untrusted.invalid/image',
            extra: '제외할 값'
          },
          { characterId: 'tie-second', characterName, serverId: 'prey', fame: 50000 }
        ]
      })
  })

  const response = await fetch(`${origin}${candidatePath}`)

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), {
    rows: [
      {
        characterId: 'top_A-1',
        characterName,
        serverId: 'hilder',
        serverName: '힐더',
        fame: 60000,
        imageUrl: 'https://img-api.neople.co.kr/df/servers/hilder/characters/top_A-1?zoom=1'
      },
      {
        characterId: 'tie-first',
        characterName,
        serverId: 'anton',
        serverName: '안톤',
        fame: 50000,
        imageUrl: 'https://img-api.neople.co.kr/df/servers/anton/characters/tie-first?zoom=1'
      },
      {
        characterId: 'tie-second',
        characterName,
        serverId: 'prey',
        serverName: '프레이',
        fame: 50000,
        imageUrl: 'https://img-api.neople.co.kr/df/servers/prey/characters/tie-second?zoom=1'
      },
      {
        characterId: 'zero',
        characterName,
        serverId: 'cain',
        serverName: '카인',
        fame: 0,
        imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/zero?zoom=1'
      },
      {
        characterId: 'null-first',
        characterName,
        serverId: 'siroco',
        serverName: '시로코',
        fame: null,
        imageUrl: 'https://img-api.neople.co.kr/df/servers/siroco/characters/null-first?zoom=1'
      },
      {
        characterId: 'omitted',
        characterName,
        serverId: 'bakal',
        serverName: '바칼',
        fame: null,
        imageUrl: 'https://img-api.neople.co.kr/df/servers/bakal/characters/omitted?zoom=1'
      }
    ]
  })
})

test('후보가 8개를 넘어도 자르지 않고 빈 검색 결과도 성공으로 구분한다', async (t) => {
  const rows = Array.from({ length: 9 }, (_, index) => {
    const characterId = `candidate-${index}`

    return { characterId, characterName, serverId: 'cain', fame: null }
  })
  let calls = 0
  const origin = await startApp(t, {
    fetch: async () => {
      calls += 1
      if (calls === 1) {
        return jsonResponse({ rows })
      }

      return jsonResponse({ rows: [] })
    }
  })

  const populated = await fetch(`${origin}${candidatePath}`)
  assert.equal(populated.status, 200)
  const body = (await populated.json()) as { rows: Array<{ characterId: string }> }
  assert.deepEqual(
    body.rows.map((row) => row.characterId),
    [
      'candidate-0',
      'candidate-1',
      'candidate-2',
      'candidate-3',
      'candidate-4',
      'candidate-5',
      'candidate-6',
      'candidate-7',
      'candidate-8'
    ]
  )

  const empty = await fetch(`${origin}${candidatePath}`)
  assert.equal(empty.status, 200)
  assert.deepEqual(await empty.json(), { rows: [] })
  assert.equal(calls, 2)
})

test('실제 HTTP에서 후보 검색은 all과 match를 고정하고 일반 검색은 full을 유지한다', async (t) => {
  const requests: Array<{ url: URL; apiKey: string | string[] | undefined }> = []
  const provider = createServer((request, response) => {
    assert(request.url)
    const url = new URL(request.url, 'http://127.0.0.1')
    const apiKey = request.headers.apikey
    requests.push({ url, apiKey })
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ rows: [] }))
  })
  t.after(async () => {
    provider.closeAllConnections()
    await new Promise<void>((resolve, reject) => {
      provider.close((error) => {
        if (error) {
          reject(error)

          return
        }
        resolve()
      })
    })
  })
  await new Promise<void>((resolve, reject) => {
    provider.once('error', reject)
    provider.listen(0, '127.0.0.1', resolve)
  })
  const address = provider.address()
  assert(address && typeof address === 'object')
  const origin = await startApp(t, { fetch, origin: `http://127.0.0.1:${address.port}` })

  for (const name of ['가', '😀', '😀'.repeat(12), '가', '가 나+&/?', '%25=']) {
    const response = await fetch(
      `${origin}/characters/candidates?characterName=${encodeURIComponent(name)}`
    )
    assert.equal(response.status, 200, name)
    assert.deepEqual(await response.json(), { rows: [] })
    const request = requests.at(-1)!
    assert.equal(request.url.pathname, '/df/servers/all/characters')
    assert.deepEqual(Object.fromEntries(request.url.searchParams), {
      characterName: name,
      limit: '200',
      wordType: 'match'
    })
    assert.equal(request.url.searchParams.size, 3)
    assert.equal(request.apiKey, 'synthetic-candidates-key')
  }

  const full = await fetch(`${origin}/characters?characterName=normal&serverId=cain&limit=1`)
  assert.equal(full.status, 200)
  assert.deepEqual(await full.json(), { rows: [] })
  assert.equal(requests.at(-1)!.url.pathname, '/df/servers/cain/characters')
  assert.deepEqual(Object.fromEntries(requests.at(-1)!.url.searchParams), {
    characterName: 'normal',
    limit: '1',
    wordType: 'full'
  })
  assert.equal(requests.at(-1)!.url.searchParams.size, 3)

  const shortFull = await fetch(`${origin}/characters?characterName=A`)
  assert.equal(shortFull.status, 400)
  assert.deepEqual(await shortFull.json(), queryError)
  assert.equal(requests.length, 7)
})

test('잘못된 후보 query는 정제된 400으로 거절하고 공급자를 호출하지 않는다', async (t) => {
  let calls = 0
  const origin = await startApp(t, {
    fetch: async () => {
      calls += 1

      return jsonResponse({ rows: [] })
    }
  })
  const cases: Array<[string, string]> = [
    ['query 없음', '/characters/candidates'],
    ['빈 이름', '/characters/candidates?characterName='],
    ['13 code point 이름', `/characters/candidates?characterName=${'a'.repeat(13)}`],
    ['앞 공백', '/characters/candidates?characterName=+AB'],
    ['뒤 공백', '/characters/candidates?characterName=AB%20'],
    ['서버 지정', `${candidatePath}&serverId=all`],
    ['limit 지정', `${candidatePath}&limit=200`],
    ['wordType 지정', `${candidatePath}&wordType=match`],
    ['중복 이름', `${candidatePath}&characterName=other`],
    ['인코딩된 중복 이름', `${candidatePath}&character%4Eame=other`],
    ['배열 key', '/characters/candidates?characterName[]=AB'],
    ['인코딩된 객체 key', '/characters/candidates?characterName%5Bx%5D=AB'],
    ['빈 query component', `${candidatePath}&`],
    ['깨진 percent escape', '/characters/candidates?characterName=%'],
    ['잘못된 UTF-8', '/characters/candidates?characterName=%FF'],
    ['잘린 UTF-8', '/characters/candidates?characterName=%E3%81'],
    ['surrogate 인코딩', '/characters/candidates?characterName=%ED%A0%80'],
    ['미지원 key', `${candidatePath}&unknown=value`]
  ]
  for (const [name, path] of cases) {
    await t.test(name, async () => {
      const response = await fetch(`${origin}${path}`)
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), queryError)
      assert.equal(calls, 0)
    })
  }
})

test('잘못된 후보 이름, 서버와 이미지 경로 값은 부분 결과 없이 전체 502로 거절한다', async (t) => {
  const valid = { characterId: 'safe-id', characterName, serverId: 'cain', fame: 1 }
  const cases: Array<[string, Record<string, unknown>]> = [
    ['검색어와 다른 이름', { characterName: '다른이름' }],
    ['all 서버', { serverId: 'all' }],
    ['미등록 서버', { serverId: 'future-server' }],
    ['prototype key 서버', { serverId: '__proto__' }],
    ['현재 경로 ID', { characterId: '.' }],
    ['상위 경로 ID', { characterId: '..' }],
    ['경로를 포함한 ID', { characterId: 'id/other' }],
    ['query를 포함한 ID', { characterId: 'id?zoom=2' }],
    ['percent 인코딩을 포함한 ID', { characterId: 'id%2Fother' }],
    ['앞뒤 공백 ID', { characterId: ' id ' }],
    ['후행 개행 ID', { characterId: 'safe-id\n' }],
    ['257자 ID', { characterId: 'a'.repeat(257) }],
    ['문자열 명성', { fame: '1' }]
  ]
  for (const [name, change] of cases) {
    await t.test(name, async (context) => {
      const origin = await startApp(context, {
        fetch: async () => jsonResponse({ rows: [valid, { ...valid, ...change }] })
      })
      const response = await fetch(`${origin}${candidatePath}`)
      assert.equal(response.status, 502)
      assert.deepEqual(await response.json(), providerError)
    })
  }
})

test('후보의 ID 검증은 256자 안전 문자를 허용하며 일반 검색의 기존 값 보존을 바꾸지 않는다', async (t) => {
  const safeId = 'A0_-'.repeat(64)
  let calls = 0
  const origin = await startApp(t, {
    fetch: async () => {
      calls += 1
      if (calls === 1) {
        return jsonResponse({
          rows: [{ characterId: safeId, characterName, serverId: 'cain', fame: null }]
        })
      }

      return jsonResponse({
        rows: [
          {
            characterId: ' id/old ',
            characterName: '다른이름',
            serverId: 'future-server',
            fame: -1.5
          }
        ]
      })
    }
  })

  const candidate = await fetch(`${origin}${candidatePath}`)
  assert.equal(candidate.status, 200)
  assert.deepEqual(await candidate.json(), {
    rows: [
      {
        characterId: safeId,
        characterName,
        serverId: 'cain',
        serverName: '카인',
        fame: null,
        imageUrl: `https://img-api.neople.co.kr/df/servers/cain/characters/${safeId}?zoom=1`
      }
    ]
  })

  const full = await fetch(`${origin}/characters?characterName=normal`)
  assert.equal(full.status, 200)
  assert.deepEqual(await full.json(), {
    rows: [
      {
        characterId: ' id/old ',
        characterName: '다른이름',
        serverId: 'future-server',
        serverName: null,
        fame: -1.5
      }
    ]
  })
})

test('공급자 실패는 빈 후보로 숨기지 않으며 일반 검색과 실패 요청까지 IP 한도를 공유한다', async (t) => {
  let calls = 0
  const clock: SearchClock = {
    now: () => 0,
    setTimer: () => 0,
    clearTimer: () => undefined
  }
  const origin = await startApp(
    t,
    {
      fetch: async () => {
        calls += 1
        if (calls === 1) {
          return jsonResponse({ error: { code: 'API901' }, rows: [] }, 503)
        }

        return jsonResponse({ rows: [] })
      }
    },
    clock
  )
  const failed = await fetch(`${origin}${candidatePath}`)
  assert.equal(failed.status, 502)
  assert.deepEqual(await failed.json(), providerError)

  const fullPath = '/characters?characterName=normal'
  for (let index = 1; index < 10; index += 1) {
    const path = index % 2 === 0 ? candidatePath : fullPath
    const response = await fetch(`${origin}${path}`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { rows: [] })
  }
  for (const path of [candidatePath, fullPath]) {
    const response = await fetch(`${origin}${path}`)
    assert.equal(response.status, 429)
    assert.equal(response.headers.get('retry-after'), '60')
    assert.deepEqual(await response.json(), {
      error: {
        code: 'SEARCH_RATE_LIMITED',
        message: '검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
      }
    })
  }
  assert.equal(calls, 10)
})
