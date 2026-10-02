import assert from 'node:assert/strict'
import { test } from 'node:test'

// Pure parser와 HTTP original URL 경계를 각각 검증한다. DB cancellation 선택과 독립적이다.
test('search query decodes exactly once and applies defaults only to omitted fields', async () => {
  const { parseCharacterSearchQuery } = await import('../dist/characters/query.js')
  for (const [query, expected] of [
    ['characterName=ab', { characterName: 'ab', serverId: 'all', limit: 10 }],
    [
      'characterName=ab&serverId=cain&limit=0001',
      { characterName: 'ab', serverId: 'cain', limit: 1 }
    ],
    ['characterName=ab&limit=200', { characterName: 'ab', serverId: 'all', limit: 200 }],
    ['characterName=a+b', { characterName: 'a b', serverId: 'all', limit: 10 }],
    ['characterName=a=b', { characterName: 'a=b', serverId: 'all', limit: 10 }],
    ['characterName=%255B%255D', { characterName: '%5B%5D', serverId: 'all', limit: 10 }],
    ['characterName=%5B%5D', { characterName: '[]', serverId: 'all', limit: 10 }]
  ]) {
    assert.deepEqual(parseCharacterSearchQuery(`/characters?${query}`), expected)
  }
})

test('search query counts Unicode code points without normalization', async () => {
  const { parseCharacterSearchQuery } = await import('../dist/characters/query.js')
  for (const characterName of ['가나', '😀가', '가', '😀'.repeat(12)]) {
    assert.deepEqual(
      parseCharacterSearchQuery(`/characters?characterName=${encodeURIComponent(characterName)}`),
      {
        characterName,
        serverId: 'all',
        limit: 10
      }
    )
  }
  for (const characterName of ['😀', '😀'.repeat(13), '\u00a0ab', 'ab\u3000']) {
    assert.throws(
      () =>
        parseCharacterSearchQuery(`/characters?characterName=${encodeURIComponent(characterName)}`),
      {
        status: 400,
        body: { error: { code: 'INVALID_SEARCH_QUERY', message: '검색 조건을 확인해 주세요.' } }
      }
    )
  }
})

test('search nickname limits agree at one, two, twelve and thirteen code points', async () => {
  const { parseCharacterSearchQuery } = await import('../dist/characters/query.js')
  for (const character of ['가', '漢', '𠀀', '😀', '♥']) {
    for (const length of [1, 2, 12, 13]) {
      const characterName = character.repeat(length)
      const parse = () =>
        parseCharacterSearchQuery(`/characters?characterName=${encodeURIComponent(characterName)}`)
      if (length === 2 || length === 12) {
        assert.equal(parse().characterName, characterName)
      } else {
        assert.throws(parse, { status: 400 })
      }
    }
  }
  for (const query of ['%ED%A0%80%EA%B0%80', '%EA%B0%80%ED%BF%BF']) {
    assert.throws(() => parseCharacterSearchQuery(`/characters?characterName=${query}`), {
      status: 400
    })
  }
})
