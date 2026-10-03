import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCharacterSearchQuery } from '../dist/characters/query.js'

const queryFailure = {
  status: 400,
  body: { error: { code: 'INVALID_SEARCH_QUERY', message: '검색 조건을 확인해 주세요.' } }
}

test('검색 query는 한 번만 decode하고 생략한 옵션에만 기본값을 적용한다', async (t) => {
  const cases = [
    ['옵션 생략', 'characterName=ab', { characterName: 'ab', serverId: 'all', limit: 10 }],
    [
      '최소 limit과 leading zero',
      'characterName=ab&serverId=cain&limit=0001',
      { characterName: 'ab', serverId: 'cain', limit: 1 }
    ],
    [
      '최대 limit',
      'characterName=ab&limit=200',
      { characterName: 'ab', serverId: 'all', limit: 200 }
    ],
    ['내부 공백', 'characterName=a+b', { characterName: 'a b', serverId: 'all', limit: 10 }],
    [
      '첫 등호 뒤의 등호 보존',
      'characterName=a=b',
      { characterName: 'a=b', serverId: 'all', limit: 10 }
    ],
    [
      'percent escape를 다시 decode하지 않음',
      'characterName=%255B%255D',
      { characterName: '%5B%5D', serverId: 'all', limit: 10 }
    ],
    [
      '배열처럼 보이는 문자열 보존',
      'characterName=%5B%5D',
      { characterName: '[]', serverId: 'all', limit: 10 }
    ],
    [
      '객체처럼 보이는 문자열 보존',
      'characterName=%7B%7D',
      { characterName: '{}', serverId: 'all', limit: 10 }
    ],
    [
      'encode된 query 구분자를 값으로 보존',
      'characterName=a%26%3D%2B%3F%23',
      { characterName: 'a&=+?#', serverId: 'all', limit: 10 }
    ],
    [
      'encode된 허용 key',
      '%63haracterName=ab&%73erverId=all&%6Cimit=0010',
      { characterName: 'ab', serverId: 'all', limit: 10 }
    ]
  ]
  for (const [name, query, expected] of cases) {
    await t.test(name, () => {
      assert.deepEqual(parseCharacterSearchQuery(`/characters?${query}`), expected)
    })
  }
})

test('검색 query는 code point를 세고 대소문자·분해된 Unicode·내부 공백을 보존한다', async (t) => {
  for (const [name, characterName] of [
    ['한글', '가나'],
    ['대소문자 혼합', 'aB'],
    ['supplementary 문자와 한글', '😀가'],
    ['분해된 한글', '가'],
    ['combining mark', 'a\u0301'],
    ['내부 ECMAScript 공백', 'a\u00a0b'],
    ['12개 supplementary 문자', '😀'.repeat(12)]
  ]) {
    await t.test(name, () => {
      assert.deepEqual(
        parseCharacterSearchQuery(`/characters?characterName=${encodeURIComponent(characterName)}`),
        {
          characterName,
          serverId: 'all',
          limit: 10
        }
      )
    })
  }
  for (const character of ['가', '漢', '𠀀', '😀', '♥']) {
    for (const length of [1, 2, 12, 13]) {
      await t.test(`${character} ${length}개 경계`, () => {
        const characterName = character.repeat(length)
        const parse = () =>
          parseCharacterSearchQuery(
            `/characters?characterName=${encodeURIComponent(characterName)}`
          )
        if (length === 2 || length === 12) {
          assert.deepEqual(parse(), { characterName, serverId: 'all', limit: 10 })
        } else {
          assert.throws(parse, queryFailure)
        }
      })
    }
  }
})

test('검색 query는 모든 허용 서버를 받고 응답용 map에 없는 요청 ID는 거절한다', () => {
  for (const serverId of [
    'all',
    'anton',
    'bakal',
    'cain',
    'casillas',
    'diregie',
    'hilder',
    'prey',
    'siroco'
  ]) {
    assert.deepEqual(
      parseCharacterSearchQuery(`/characters?characterName=ab&serverId=${serverId}`),
      {
        characterName: 'ab',
        serverId,
        limit: 10
      }
    )
  }
  for (const serverId of [
    '',
    'CAIN',
    ' cain',
    'cain ',
    'future-server',
    'constructor',
    '__proto__'
  ]) {
    assert.throws(
      () =>
        parseCharacterSearchQuery(
          `/characters?characterName=ab&serverId=${encodeURIComponent(serverId)}`
        ),
      queryFailure
    )
  }
})

test('검색 query는 잘못된 UTF-8·구조·숫자·앞뒤 공백을 정제된 400으로 거절한다', async (t) => {
  const cases = [
    ['query 없음', '/characters'],
    ['빈 query', '/characters?'],
    ['필수 검색어 없음', '/characters?limit=10'],
    ['등호 없는 검색어', '/characters?characterName'],
    ['중복 검색어', '/characters?characterName=ab&%63haracterName=cd'],
    ['중복 서버', '/characters?characterName=ab&serverId=all&%73erverId=cain'],
    ['중복 limit', '/characters?characterName=ab&limit=1&%6Cimit=2'],
    ['encode된 배열 key', '/characters?characterName=ab&limit%5B%5D=1'],
    ['encode된 객체 key', '/characters?characterName%5Bx%5D=ab'],
    ['알 수 없는 encode된 key', '/characters?characterName=ab&%77ordType=full'],
    ['빈 중간 component', '/characters?characterName=ab&&limit=1'],
    ['빈 마지막 component', '/characters?characterName=ab&'],
    ['encode된 key의 잘못된 escape', '/characters?characterName=ab&limit%=1'],
    ['짧은 escape', '/characters?characterName=%A'],
    ['UTF-8 continuation만 존재', '/characters?characterName=%80%BF'],
    ['잘린 UTF-8', '/characters?characterName=%E3%81'],
    ['UTF-16 high surrogate', '/characters?characterName=%ED%A0%80%EA%B0%80'],
    ['UTF-16 low surrogate', '/characters?characterName=%EA%B0%80%ED%BF%BF'],
    ['부호 있는 limit', '/characters?characterName=ab&limit=%2B1'],
    ['공백 있는 limit', '/characters?characterName=ab&limit=1+'],
    ['숫자 뒤 문자', '/characters?characterName=ab&limit=1x'],
    ['숫자 범위 초과', '/characters?characterName=ab&limit=99999999999999999999999999999999999']
  ]
  for (const whitespace of ['\t', '\n', '\u00a0', '\ufeff', '\u3000']) {
    cases.push([
      `앞 공백 U+${whitespace.codePointAt(0).toString(16)}`,
      `/characters?characterName=${encodeURIComponent(whitespace + 'ab')}`
    ])
    cases.push([
      `뒤 공백 U+${whitespace.codePointAt(0).toString(16)}`,
      `/characters?characterName=${encodeURIComponent('ab' + whitespace)}`
    ])
  }
  for (const [name, originalUrl] of cases) {
    await t.test(name, () =>
      assert.throws(() => parseCharacterSearchQuery(originalUrl), queryFailure)
    )
  }
})
