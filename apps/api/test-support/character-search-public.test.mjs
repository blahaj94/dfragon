import assert from 'node:assert/strict'
import test from 'node:test'
import { withSearchApp, expectSearchError } from './character-search-fixtures.mjs'

test('공개 검색은 loopback 공급자의 후보를 정제한다', async () => {
  await withSearchApp(async ({ base, calls, upstream }) => {
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
})

test('잘못된 공개 검색 query는 공급자를 호출하지 않는다', async () => {
  await withSearchApp(async ({ base, calls }) => {
    await expectSearchError(
      await fetch(`${base}/characters?unknown=%FF`),
      400,
      'INVALID_SEARCH_QUERY'
    )
    await expectSearchError(
      await fetch(`${base}/characters?characterName=ab&limit=1&%6Cimit=2`),
      400,
      'INVALID_SEARCH_QUERY'
    )
    await expectSearchError(
      await fetch(`${base}/characters?characterName=%FF`),
      400,
      'INVALID_SEARCH_QUERY'
    )
    assert.deepEqual(calls, [])
  })
})
