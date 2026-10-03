import assert from 'node:assert/strict'
import {
  searchFixture,
  withSearchApp,
  searchRequest,
  expectSearchError,
  snapshot
} from './character-search-fixtures.mjs'

async function publicSearch(source) {
  const f = await searchFixture(source)
  const before = await snapshot(source, f)
  await withSearchApp(f, async ({ base, calls, upstream }) => {
    upstream.body = {
      rows: [
        {
          characterId: 'candidate',
          characterName: '가나',
          serverId: 'cain',
          fame: 0,
          privateField: 'excluded'
        },
        { characterId: 'future', characterName: 'other', serverId: 'future-server', fame: null }
      ]
    }
    const response = await fetch(`${base}/characters?characterName=%EA%B0%80%EB%82%98`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      rows: [
        {
          characterId: 'candidate',
          characterName: '가나',
          serverId: 'cain',
          serverName: '카인',
          fame: 0
        },
        {
          characterId: 'future',
          characterName: 'other',
          serverId: 'future-server',
          serverName: null,
          fame: null
        }
      ]
    })
    assert.deepEqual(calls, [
      {
        path: '/df/servers/all/characters',
        query: { characterName: '가나', limit: '10', wordType: 'full' },
        hasExpectedKey: true
      }
    ])
  })
  assert.deepEqual(await snapshot(source, f), before)
}

async function initialRejections(source) {
  const f = await searchFixture(source)
  const before = await snapshot(source, f)
  await withSearchApp(
    f,
    async ({ base, calls }) => {
      await expectSearchError(
        await fetch(`${base}/characters?unknown=%FF`),
        400,
        'INVALID_SEARCH_QUERY'
      )
      await expectSearchError(
        await searchRequest(base, f, 'characterName=ab&limit=1&%6Cimit=2'),
        400,
        'INVALID_SEARCH_QUERY'
      )
      await expectSearchError(
        await searchRequest(base, f, 'characterName=%FF'),
        400,
        'INVALID_SEARCH_QUERY'
      )
      assert.deepEqual(calls, [])
    },
    { apiKey: '' }
  )
  assert.deepEqual(await snapshot(source, f), before)
}

export async function assertCharacterSearchHttpIntegration(source, mark) {
  const cases = [
    [
      '공개 검색은 loopback 공급자의 후보를 정제하고 저장된 캐릭터 목록을 유지한다',
      () => publicSearch(source)
    ],
    [
      '잘못된 공개 검색 query는 공급자를 호출하지 않고 저장된 캐릭터 목록을 유지한다',
      () => initialRejections(source)
    ]
  ]
  for (const [name, run] of cases) {
    mark(name)
    await run()
  }

  return cases.length
}
