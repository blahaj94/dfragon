import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { PassThrough } from 'node:stream'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import { loginJsonParser } from '../dist/auth/login/json-parser.js'
import { LoginFailure } from '../dist/errors/login.js'

function parserFixture(rawHeaders = ['Content-Type', 'application/json']) {
  const request = new PassThrough({ autoDestroy: false })
  Object.assign(request, {
    method: 'POST',
    path: '/auth/exchange',
    rawHeaders
  })
  const responses = []
  const nextCalls = []
  const headers = {}
  const response = {
    headersSent: false,
    destroyed: false,
    setHeader: (name, value) => {
      headers[name] = value
    },
    status: (status) => ({
      json: (body) => responses.push({ status, body })
    })
  }
  loginJsonParser(request, response, (error) => nextCalls.push(error))

  return { request, response, responses, nextCalls, headers }
}

test('중복 media header는 body를 읽기 전에 거절한다', () => {
  for (const rawHeaders of [
    ['Content-Type', 'application/json', 'Content-Type', 'application/json'],
    ['Content-Type', 'application/json', 'Content-Encoding', 'identity', 'Content-Encoding', 'gzip']
  ]) {
    const f = parserFixture(rawHeaders)
    assert.equal(f.responses.length, 1)
    assert.equal(f.responses[0].status, 415)
    assert.equal(f.nextCalls.length, 0)
    assert.equal(f.request.isPaused(), true)
    f.request.destroy()
  }
})

test('선언 Content-Length가 상한을 넘으면 body를 읽기 전에 거절한다', () => {
  const f = parserFixture(['Content-Type', 'application/json', 'Content-Length', '16385'])
  assert.equal(f.responses.length, 1)
  assert.equal(f.responses[0].status, 413)
  assert.equal(f.nextCalls.length, 0)
  assert.equal(f.request.isPaused(), true)
  f.request.destroy()
})

function assertInvalidResponse(responses) {
  assert.deepEqual(responses, [
    {
      status: 400,
      body: {
        error: {
          code: 'INVALID_AUTH_REQUEST',
          message: '인증 요청을 확인해 주세요.'
        }
      }
    }
  ])
}

test('지원하지 않는 media·encoding은 초과 선언 길이보다 먼저 정제 415로 거절한다', async (t) => {
  const cases = [
    { name: 'Content-Type 없음', headers: [] },
    { name: 'JSON이 아닌 media', headers: ['Content-Type', 'text/plain'] },
    { name: 'UTF-8이 아닌 charset', headers: ['Content-Type', 'application/json; charset=utf-16'] },
    {
      name: '압축된 JSON',
      headers: ['Content-Type', 'application/json', 'Content-Encoding', 'gzip']
    }
  ]
  for (const { name, headers } of cases) {
    await t.test(name, () => {
      const f = parserFixture([...headers, 'Content-Length', '16385'])
      assert.deepEqual(f.responses, [
        {
          status: 415,
          body: {
            error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'JSON 형식으로 요청해 주세요.' }
          }
        }
      ])
      assert.deepEqual(f.nextCalls, [])
      assert.equal(f.request.body, undefined)
      assert.equal(f.request.listenerCount('data'), 0)
      assert.equal(f.request.isPaused(), true)
      assert.equal(f.headers.Connection, 'close')
      f.request.destroy()
    })
  }
})

test('정확히 16,384-byte인 UTF-8 JSON은 chunk 경계와 지원 media 표기와 무관하게 받는다', async () => {
  const value = { code: '한'.repeat(5457) }
  const json = Buffer.from(JSON.stringify(value))
  const body = Buffer.concat([json, Buffer.alloc(16384 - json.length, ' ')])
  assert.equal(body.length, 16384)
  for (const contentType of ['application/json', 'Application/JSON; Charset="UTF-8"']) {
    const f = parserFixture(['Content-Type', contentType, 'Content-Encoding', 'identity'])
    const split = Buffer.byteLength('{"code":"') + 1
    f.request.write(body.subarray(0, split))
    assert.deepEqual(f.nextCalls, [])
    f.request.end(body.subarray(split))
    await setImmediate()
    assert.deepEqual(f.request.body, value)
    assert.deepEqual(f.nextCalls, [undefined])
    assert.deepEqual(f.responses, [])
    assert.equal(f.request.listenerCount('data'), 0)
    f.request.destroy()
  }
})

test('작게 선언한 길이도 실제 chunk가 16,384 byte를 넘으면 malformed JSON보다 먼저 413이다', async () => {
  const f = parserFixture(['Content-Type', 'application/json', 'Content-Length', '1'])
  f.request.write(Buffer.alloc(16384, 'x'))
  assert.deepEqual(f.responses, [])
  f.request.write('x')
  assert.deepEqual(f.responses, [
    {
      status: 413,
      body: { error: { code: 'REQUEST_TOO_LARGE', message: '요청 크기를 줄여 주세요.' } }
    }
  ])
  assert.deepEqual(f.nextCalls, [])
  assert.equal(f.request.body, undefined)
  assert.equal(f.headers.Connection, 'close')
  assert.equal(f.request.isPaused(), true)
  assert.equal(f.request.listenerCount('data'), 0)
  f.request.destroy()
  await setImmediate()
})

test('분할된 UTF-8은 수집 뒤 decode하고 잘린 UTF-8·BOM은 무효 입력으로 거절한다', async () => {
  const body = Buffer.from('{"code":"한"}')
  const split = Buffer.byteLength('{"code":"') + 1
  const valid = parserFixture()
  valid.request.write(body.subarray(0, split))
  assert.deepEqual(valid.nextCalls, [])
  valid.request.end(body.subarray(split))
  await setImmediate()
  assert.deepEqual(valid.request.body, { code: '한' })
  assert.deepEqual(valid.nextCalls, [undefined])
  assert.deepEqual(valid.responses, [])
  valid.request.destroy()

  for (const bytes of [
    body.subarray(0, split),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body])
  ]) {
    const invalid = parserFixture()
    invalid.request.end(bytes)
    await setImmediate()
    assert.equal(invalid.nextCalls.length, 1)
    assert.ok(invalid.nextCalls[0] instanceof LoginFailure)
    assert.equal(invalid.nextCalls[0].code, 'INVALID_AUTH_REQUEST')
    assert.equal(invalid.nextCalls[0].message, '인증 요청을 확인해 주세요.')
    assert.equal(invalid.request.body, undefined)
    assert.deepEqual(invalid.responses, [])
    invalid.request.destroy()
  }
})

test('request error의 원문 metadata가 raw-body 오류와 닮아도 정제 400을 반환한다', async () => {
  for (const type of [undefined, 'entity.too.large', 'request.aborted']) {
    const f = parserFixture()
    f.request.write('{"code":"fixture-credential')
    f.request.emit(
      'error',
      Object.assign(new Error('fixture-private-detail'), { type, status: 413 })
    )
    await setImmediate()
    assertInvalidResponse(f.responses)
    assert.deepEqual(f.nextCalls, [])
    assert.equal(f.request.body, undefined)
    assert.equal(f.request.listenerCount('data'), 0)
    assert.equal(f.request.listenerCount('end'), 0)
    f.request.destroy()
  }
})

test('header 전송·response 파기 후 request error는 응답을 쓰지 않는다', async () => {
  for (const state of ['headersSent', 'destroyed']) {
    const f = parserFixture()
    f.response[state] = true
    f.request.emit('error', new Error('fixture-private-detail'))
    await setImmediate()
    assert.deepEqual(f.responses, [])
    assert.deepEqual(f.nextCalls, [])
    f.request.destroy()
  }
})

test('abort 이후 request error는 응답하거나 다음 middleware를 실행하지 않는다', async () => {
  const f = parserFixture()
  f.request.write('{"code":"fixture-credential')
  f.request.emit('aborted')
  f.request.emit('error', new Error('fixture-private-detail'))
  await setImmediate()
  assert.deepEqual(f.responses, [])
  assert.deepEqual(f.nextCalls, [])
  assert.equal(f.request.body, undefined)
  assert.equal(f.request.listenerCount('data'), 0)
  assert.equal(f.request.listenerCount('end'), 0)
  f.request.destroy()
})

test('초과 payload는 end 전에 413을 보내고 늦은 request error가 이를 덮어쓰지 않는다', async () => {
  const f = parserFixture()
  f.request.write(Buffer.alloc(8192, 'x'))
  f.request.write(Buffer.alloc(8193, 'x'))
  assert.equal(f.responses.length, 1)
  assert.equal(f.responses[0].status, 413)
  assert.equal(f.responses[0].body.error.code, 'REQUEST_TOO_LARGE')
  assert.equal(f.headers.Connection, 'close')
  assert.equal(f.request.isPaused(), true)
  f.request.emit('error', new Error('fixture-private-detail'))
  await setImmediate()
  assert.equal(f.responses.length, 1)
  assert.deepEqual(f.nextCalls, [])
  assert.equal(f.request.body, undefined)
  f.request.destroy()
})

test('처리 종료는 수집 listener를 해제하고 close는 늦은 error guard를 해제한다', async () => {
  for (const outcome of ['success', 'invalid', 'overflow', 'error', 'aborted']) {
    const f = parserFixture()
    switch (outcome) {
      case 'success':
        f.request.end('{}')
        break
      case 'invalid':
        f.request.end('{')
        break
      case 'overflow':
        f.request.write(Buffer.alloc(16385))
        break
      case 'error':
        f.request.emit('error', new Error('fixture-private-detail'))
        break
      case 'aborted':
        f.request.emit('aborted')
        break
    }
    await setImmediate()
    for (const event of ['data', 'end', 'aborted']) {
      assert.equal(f.request.listenerCount(event), 0, `${outcome}: ${event}`)
    }
    f.request.destroy()
    await setImmediate()
    assert.equal(f.request.listenerCount('error'), 0, outcome)
    assert.equal(f.request.listenerCount('close'), 0, outcome)
  }
})
