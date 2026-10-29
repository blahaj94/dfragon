import assert from 'node:assert/strict'
import { request } from 'node:http'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import { createApiHttpApp } from '../dist/http.js'
import {
  unusedDetailProviders,
  unusedTodayGradeProvider,
  withSearchApp
} from './character-search-fixtures.mjs'

async function withSearchBoundary(operation) {
  let upstreamCalls = 0
  const app = await createApiHttpApp({
    search: {
      async searchCharacters() {
        upstreamCalls++
        throw new Error('예상하지 않은 공급자 호출')
      }
    },
    details: unusedDetailProviders(),
    todayGrade: unusedTodayGradeProvider()
  })
  try {
    await app.listen(0, '127.0.0.1')
    await operation(await app.getUrl())
    assert.equal(upstreamCalls, 0)
  } finally {
    await app.close()
  }
}

function rawGet(base, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const pending = request(`${base}${path}`, { method: 'GET', headers }, (response) => {
      const parts = []
      response.on('error', reject)
      response.on('data', (part) => parts.push(part))
      response.on('end', () => {
        const status = response.statusCode
        const headers = response.headers
        const body = Buffer.concat(parts).toString('utf8')

        resolve({ status, headers, body })
      })
    })
    pending.once('error', reject)
    pending.end()
  })
}

function expectSearchError(response, status, code, message) {
  assert.equal(response.status, status)
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.match(response.headers['content-type'], /^application\/json/)
  assert.deepEqual(JSON.parse(response.body), { error: { code, message } })
}

function expectEmptyRows(response, name) {
  assert.equal(response.status, 200, name)
  assert.equal(response.headers['cache-control'], 'no-store', name)
  assert.match(response.headers['content-type'], /^application\/json/, name)
  assert.deepEqual(JSON.parse(response.body), { rows: [] }, name)
}

const queryMessage = '검색 조건을 확인해 주세요.'

const authorizationCases = [
  { name: 'Authorization 없는 요청', headers: {} },
  { name: 'Basic 인증 형식', headers: { authorization: 'Basic invalid' } },
  { name: '소문자 bearer 인증 형식', headers: { authorization: 'bearer invalid' } },
  { name: '값이 없는 Bearer', headers: { authorization: 'Bearer' } },
  { name: '공백으로 구분한 여러 Bearer 값', headers: { authorization: 'Bearer first second' } },
  { name: '콤마로 구분한 여러 Bearer 값', headers: { authorization: 'Bearer first,second' } },
  {
    name: '중복 Authorization 헤더',
    headers: { authorization: ['Bearer first', 'Bearer second'] }
  },
  { name: '유효하지 않은 Bearer 값', headers: { authorization: 'Bearer invalid-or-expired' } },
  {
    name: 'JWT 형태의 Bearer 값',
    headers: { authorization: 'Bearer e30.e30.synthetic-signature' }
  },
  {
    name: '과거 exp를 가진 JWT 형태의 값',
    headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.synthetic-signature' }
  }
]

test('공개 검색의 잘못된 query는 Authorization 형식과 무관하게 공급자 호출 전에 거절된다', async () => {
  await withSearchBoundary(async (base) => {
    for (const { name, headers } of authorizationCases) {
      const response = await rawGet(base, '/characters?limit=%FF&accessToken=query-token', headers)
      expectSearchError(response, 400, 'INVALID_SEARCH_QUERY', queryMessage)
      assert.equal(response.headers['retry-after'], undefined, name)
    }
  })
})

test('검색 HTTP는 raw 구조와 UTF-8 오류를 공급자 호출 전에 거절한다', async () => {
  const invalidQueries = [
    '',
    'characterName=',
    'characterName=a',
    `characterName=${'a'.repeat(13)}`,
    'characterName=%20ab',
    'characterName=ab+',
    'characterName=ab&characterName=cd',
    'characterName=ab&%63haracterName=cd',
    'characterName=ab&limit=1&%6Cimit=2',
    'characterName=ab&serverId=all&serverId=cain',
    'characterName=ab&limit[]=1',
    'characterName=ab&limit%5B0%5D=1',
    'characterName[x]=ab',
    'characterName=ab&unknown=x',
    'characterName=ab&&limit=1',
    'characterName=ab&',
    'characterName=%',
    'characterName=%GG',
    'characterName=%C0%AF',
    'characterName=%ED%A0%80',
    'characterName=%F4%90%80%80',
    'characterName=%FF',
    'characterName=ab&serverId=',
    'characterName=ab&serverId=CAIN',
    'characterName=ab&serverId=future-server',
    'characterName=ab&limit=',
    'characterName=ab&limit=0',
    'characterName=ab&limit=201',
    'characterName=ab&limit=-1',
    'characterName=ab&limit=1.0',
    'characterName=ab&limit=1e2',
    'characterName=ab&limit=%EF%BC%91'
  ]
  await withSearchBoundary(async (base) => {
    for (const query of invalidQueries) {
      expectSearchError(
        await rawGet(base, `/characters?${query}`),
        400,
        'INVALID_SEARCH_QUERY',
        queryMessage
      )
    }
    expectSearchError(await rawGet(base, '/characters'), 400, 'INVALID_SEARCH_QUERY', queryMessage)
  })
})

test('HEAD와 잘못된 검색 query는 공급자를 호출하지 않고 같은 IP의 정상 GET은 IP별 한도 없이 처리한다', async () => {
  await withSearchApp(async ({ base, calls }) => {
    const head = await fetch(`${base}/characters?characterName=ab`, { method: 'HEAD' })
    assert.equal(head.status, 400)
    assert.equal(head.headers.get('cache-control'), 'no-store')
    assert.equal(await head.text(), '')
    expectSearchError(
      await rawGet(base, '/characters?characterName=ab&unknown=1'),
      400,
      'INVALID_SEARCH_QUERY',
      queryMessage
    )
    assert.deepEqual(calls, [])
    for (let index = 0; index < 12; index++) {
      expectEmptyRows(await rawGet(base, '/characters?characterName=ab'))
    }
    assert.equal(calls.length, 12)
  })
})

test('공개 검색은 Authorization 형식과 전달 IP와 무관하게 IP별 한도 없이 성공한다', async () => {
  await withSearchApp(async ({ base, calls }) => {
    for (const [index, { name, headers }] of authorizationCases.entries()) {
      const response = await rawGet(base, '/characters?characterName=ab', {
        'x-forwarded-for': `192.0.2.${index + 1}`,
        ...headers
      })
      expectEmptyRows(response, name)
    }
    const response = await rawGet(base, '/characters?characterName=ab', {
      'x-forwarded-for': '198.51.100.1',
      authorization: 'Bearer another-access-value'
    })
    expectEmptyRows(response, '열한 번째 요청')
    assert.equal(calls.length, 11)
  })
})
