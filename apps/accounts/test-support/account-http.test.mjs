import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createConnection } from 'node:net'
import { URL } from 'node:url'
import { test } from 'node:test'
import { withAccountApp, rawAccountRequest, expectAccountError } from './account-http-fixtures.mjs'

test('계정 HEAD는 JWT 검증·DB 조회·활동 전에 거절한다', async () => {
  let databaseCalls = 0
  let verifications = 0
  const source = {
    transaction: async () => {
      databaseCalls++
      throw new Error('unexpected database call')
    }
  }
  const f = {
    deps: { dataSource: source },
    verifyJwt: async () => {
      verifications++
      throw new Error('unexpected verifier call')
    }
  }
  await withAccountApp(f, async (base) => {
    const head = await fetch(`${base}/me`, { method: 'HEAD' })
    assert.equal(head.status, 400)
    assert.equal(head.headers.get('cache-control'), 'no-store')
    assert.equal(await head.text(), '')
  })
  assert.equal(verifications, 0)
  assert.equal(databaseCalls, 0)
})

test('계정 GET의 JWT 검증 실패는 상세 노출과 DB 활동 없이 정제한다', async () => {
  let databaseCalls = 0
  const source = {
    transaction: async () => {
      databaseCalls++
      throw new Error('private database detail')
    }
  }
  const f = {
    deps: { dataSource: source },
    verifyJwt: async () => {
      throw new Error('private token detail')
    }
  }
  await withAccountApp(f, async (base) => {
    const response = await fetch(`${base}/me`, { headers: { authorization: 'Bearer invalid' } })
    await expectAccountError(response, 401, 'AUTHENTICATION_REQUIRED')
  })
  assert.equal(databaseCalls, 0)
})

function rawWire(base, wire) {
  const url = new URL(base)

  return new Promise((resolve, reject) => {
    let response = ''
    const socket = createConnection({ host: url.hostname, port: Number(url.port) })
    socket.setTimeout(3000, () => {
      socket.destroy()
      reject(new Error('raw account HTTP did not close'))
    })
    socket.once('connect', () => socket.write(wire))
    socket.on('data', (chunk) => {
      response += chunk.toString('utf8')
    })
    socket.once('error', reject)
    socket.once('close', () => resolve(response))
  })
}

test('계정 PATCH overflow는 stream 종료 전에 연결을 닫고 framing 오류의 입력을 숨긴다', async () => {
  let verifications = 0
  const f = {
    deps: {},
    verifyJwt: async () => {
      verifications++
      throw new Error('unexpected verifier')
    }
  }
  await withAccountApp(f, async (base) => {
    const headers =
      'PATCH /me/nickname HTTP/1.1\r\nHost: test.invalid\r\nContent-Type: application/json\r\n'
    const overflow = await rawWire(
      base,
      headers +
        'Transfer-Encoding: chunked\r\n\r\n' +
        '2000\r\n' +
        'x'.repeat(8192) +
        '\r\n2001\r\n' +
        'x'.repeat(8193) +
        '\r\n'
    )
    assert.match(overflow, /^HTTP\/1\.1 413/)
    assert.match(overflow, /Cache-Control: no-store/i)
    assert.match(overflow, /Connection: close/i)
    assert.match(overflow, /REQUEST_TOO_LARGE/)

    const framing = await rawWire(
      base,
      headers + 'Content-Length: 1\r\nTransfer-Encoding: chunked\r\n\r\ncredential-canary'
    )
    assert.match(framing, /^HTTP\/1\.1 400/)
    assert.doesNotMatch(framing, /credential-canary|Parse Error|stack/)
    assert.equal(verifications, 0)
  })
})

test('계정 PATCH는 transport·JWT·필드 순서로 거절하고 활동을 기록하지 않는다', async () => {
  let verifications = 0
  let databaseCalls = 0
  const source = {
    transaction: async () => {
      databaseCalls++
      throw new Error('unexpected DB')
    }
  }
  const f = {
    deps: { dataSource: source },
    verifyJwt: async () => {
      verifications++
      throw new Error('private JWT')
    }
  }
  const transport = [
    [{ 'content-type': 'text/plain' }, [Buffer.alloc(17_000)], 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [
      { 'content-type': 'application/json', 'content-encoding': 'gzip' },
      ['{}'],
      415,
      'UNSUPPORTED_MEDIA_TYPE'
    ],
    [{ 'content-type': 'application/json;charset=latin1' }, ['{}'], 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [
      { 'content-type': 'application/json' },
      [Buffer.alloc(8_000), Buffer.alloc(8_385)],
      413,
      'REQUEST_TOO_LARGE'
    ],
    [
      { 'content-type': 'application/json' },
      [Buffer.alloc(16_384, 'x')],
      400,
      'INVALID_AUTH_REQUEST'
    ],
    [{ 'content-type': 'application/json' }, [Buffer.from([0xff])], 400, 'INVALID_AUTH_REQUEST'],
    [{ 'content-type': 'application/json' }, [], 400, 'INVALID_AUTH_REQUEST'],
    [{ 'content-type': 'application/json' }, ['{'], 400, 'INVALID_AUTH_REQUEST']
  ]
  await withAccountApp(f, async (base) => {
    for (const [headers, chunks, status, code] of transport) {
      const response = await rawAccountRequest(base, {
        headers: { ...headers, authorization: 'Bearer invalid' },
        chunks
      })
      assert.equal(response.status, status)
      assert.equal(response.headers['cache-control'], 'no-store')
      assert.equal(JSON.parse(response.body).error.code, code)
      assert.equal(verifications, 0)
    }
    for (const input of [
      null,
      [],
      {},
      { nickname: 1 },
      { nickname: '\ud800' },
      { nickname: 'ok', userId: 'untrusted' }
    ]) {
      const response = await fetch(`${base}/me/nickname`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: 'Bearer invalid' },
        body: JSON.stringify(input)
      })
      await expectAccountError(response, 401, 'AUTHENTICATION_REQUIRED')
    }
  })
  assert.equal(verifications, 6)
  assert.equal(databaseCalls, 0)
})

test('유효 JWT라도 잘못된 nickname 입력은 DB 활동·변경 없이 거절한다', async () => {
  let verifications = 0
  let databaseCalls = 0
  const f = {
    deps: {
      dataSource: {
        async transaction() {
          databaseCalls++
          throw new Error('입력 거절 후 DB transaction을 열 수 없음')
        }
      }
    },
    async verifyJwt(token) {
      verifications++
      assert.equal(token, 'valid-access-placeholder')
      const issuedAt = Math.floor(Date.now() / 1000)
      const expiresAt = issuedAt + 900

      return {
        userId: '00000000-0000-4000-8000-000000000001',
        sessionId: '00000000-0000-4000-8000-000000000002',
        issuedAt,
        expiresAt
      }
    }
  }
  const cases = [
    ['body가 null', null, 'INVALID_AUTH_REQUEST', '인증 요청을 확인해 주세요.'],
    ['배열 body', [], 'INVALID_AUTH_REQUEST', '인증 요청을 확인해 주세요.'],
    ['nickname 필드 없음', {}, 'INVALID_AUTH_REQUEST', '인증 요청을 확인해 주세요.'],
    [
      '회원 ID 추가',
      { nickname: '새 이름', userId: 'untrusted-user-canary' },
      'INVALID_AUTH_REQUEST',
      '인증 요청을 확인해 주세요.'
    ],
    [
      'token 추가',
      { nickname: '새 이름', accessToken: 'access-token-canary' },
      'INVALID_AUTH_REQUEST',
      '인증 요청을 확인해 주세요.'
    ],
    ['문자열 아님', { nickname: 1 }, 'INVALID_NICKNAME', '닉네임을 확인해 주세요.'],
    ['빈 닉네임', { nickname: '   ' }, 'INVALID_NICKNAME', '닉네임을 확인해 주세요.'],
    ['원문 개행', { nickname: '이름\n' }, 'INVALID_NICKNAME', '닉네임을 확인해 주세요.'],
    ['분리 surrogate', { nickname: '\ud800' }, 'INVALID_NICKNAME', '닉네임을 확인해 주세요.'],
    ['21 grapheme', { nickname: '가'.repeat(21) }, 'INVALID_NICKNAME', '닉네임을 확인해 주세요.']
  ]
  await withAccountApp(f, async (base) => {
    for (const [name, body, code, message] of cases) {
      const response = await fetch(`${base}/me/nickname`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer valid-access-placeholder'
        },
        body: JSON.stringify(body)
      })
      assert.equal(response.status, 400, name)
      assert.equal(response.headers.get('cache-control'), 'no-store', name)
      assert.deepEqual(await response.json(), { error: { code, message } }, name)
    }
  })
  assert.equal(verifications, cases.length)
  assert.equal(databaseCalls, 0)
})
