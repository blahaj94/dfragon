import assert from 'node:assert/strict'
import test from 'node:test'
import { createApiHttpApp } from '../src/http.js'
import { parseAdventureSearchQuery } from '../src/adventures/query.js'
import type { AdventureSearchQuery } from '../src/adventures/query.js'
import { createAdventureSearchService } from '../src/adventures/service.js'

const url = '/adventures/characters?adventureName=' + encodeURIComponent('합성모험단')
const empty = { adventureName: '합성모험단', scope: 'stored' as const, rows: [], nextAfter: null }
const queryFailure = {
  status: 400,
  body: { error: { code: 'INVALID_CHARACTER_QUERY', message: '캐릭터 조회 조건을 확인해 주세요.' } }
}
const internalFailure = {
  status: 500,
  body: {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 오류로 캐릭터 정보를 처리하지 못했습니다.'
    }
  }
}

test('모험단 query는 이름을 그대로 보존하고 생략한 페이지 옵션에만 기본값을 적용한다', async (t) => {
  const cases: Array<[string, string, AdventureSearchQuery]> = [
    ['기본 페이지', url, { adventureName: '합성모험단', limit: 100, after: null }],
    [
      '최소 limit과 cursor',
      url + '&limit=0001&after=fixture-id',
      { adventureName: '합성모험단', limit: 1, after: 'fixture-id' }
    ],
    ['최대 limit', url + '&limit=100', { adventureName: '합성모험단', limit: 100, after: null }],
    [
      'SQL 구분자처럼 보이는 이름',
      '/?adventureName=%25_%27',
      { adventureName: "%_'", limit: 100, after: null }
    ],
    [
      '한 번만 decode한 이름',
      '/?adventureName=%2525_%2527',
      { adventureName: '%25_%27', limit: 100, after: null }
    ],
    [
      '앞뒤 공백을 포함한 이름',
      '/?adventureName=+AB+',
      { adventureName: ' AB ', limit: 100, after: null }
    ],
    [
      '등호를 포함한 이름',
      '/?adventureName=단=이름',
      { adventureName: '단=이름', limit: 100, after: null }
    ],
    [
      '분해된 Unicode 이름',
      '/?adventureName=' + encodeURIComponent('가'),
      { adventureName: '가', limit: 100, after: null }
    ],
    [
      '한 code point 이름',
      '/?adventureName=' + encodeURIComponent('😀'),
      { adventureName: '😀', limit: 100, after: null }
    ],
    [
      '100 code point 이름',
      '/?adventureName=' + encodeURIComponent('😀'.repeat(100)),
      { adventureName: '😀'.repeat(100), limit: 100, after: null }
    ],
    [
      '256자 cursor',
      url + '&after=' + 'A0_-'.repeat(64),
      { adventureName: '합성모험단', limit: 100, after: 'A0_-'.repeat(64) }
    ],
    [
      '배열처럼 보이는 이름',
      '/?adventureName=%5B%5D',
      { adventureName: '[]', limit: 100, after: null }
    ]
  ]
  for (const [name, originalUrl, expected] of cases) {
    await t.test(name, () => assert.deepEqual(parseAdventureSearchQuery(originalUrl), expected))
  }
})

test('모험단 query는 잘못된 구조·UTF-8·이름·페이지 경계를 정제된 400으로 거절한다', async (t) => {
  const cases: Array<[string, string]> = [
    ['query 없음', '/adventures/characters'],
    ['빈 query', '/?'],
    ['빈 이름', '/?adventureName='],
    ['공백뿐인 이름', '/?adventureName=++'],
    ['제어 문자 NUL', '/?adventureName=%00'],
    ['유효하지 않은 UTF-8', '/?adventureName=%FF'],
    ['잘린 UTF-8', '/?adventureName=%E3%81'],
    ['UTF-16 surrogate', '/?adventureName=%ED%A0%80'],
    ['잘못된 key escape', url + '&limit%=1'],
    ['101 code point 이름', '/?adventureName=' + encodeURIComponent('😀'.repeat(101))],
    ['encode된 중복 이름', url + '&adventure%4Eame=duplicate'],
    ['encode된 중복 limit', url + '&limit=1&%6Cimit=2'],
    ['중복 cursor', url + '&after=a&%61fter=b'],
    ['배열 key', url + '&limit[]=1'],
    ['encode된 객체 key', '/?adventureName%5Bx%5D=ab'],
    ['미지원 서버 filter', url + '&serverId=siroco'],
    ['0 limit', url + '&limit=0'],
    ['101 limit', url + '&limit=101'],
    ['빈 limit', url + '&limit='],
    ['소수 limit', url + '&limit=1.5'],
    ['지수 limit', url + '&limit=1e2'],
    ['부호 있는 limit', url + '&limit=%2B1'],
    ['비ASCII limit', url + '&limit=%EF%BC%91'],
    ['빈 cursor', url + '&after='],
    ['경로 형식 cursor', url + '&after=../id'],
    ['공백 있는 cursor', url + '&after=a+b'],
    ['257자 cursor', url + '&after=' + 'a'.repeat(257)],
    ['빈 마지막 component', url + '&'],
    ['빈 중간 component', url + '&&limit=1'],
    ['등호 없는 component', url + '&unknown']
  ]
  for (const control of ['\t', '\n', '\u007f', '\u0085']) {
    cases.push([
      `이름의 제어 문자 U+${control.codePointAt(0)!.toString(16)}`,
      '/?adventureName=' + encodeURIComponent('ab' + control)
    ])
  }
  for (const [name, originalUrl] of cases) {
    await t.test(name, () =>
      assert.throws(() => parseAdventureSearchQuery(originalUrl), queryFailure)
    )
  }
})

test('공개 모험단 HTTP는 입력 실패를 한도에 포함하지 않고 DB 실패와 한도 오류를 정제한다', async (t) => {
  let calls = 0
  let failing = false
  const app = await createApiHttpApp({ apiKey: 'synthetic' }, undefined, {
    search: async (input) => {
      calls++
      assert.deepEqual(input, { adventureName: '합성모험단', limit: 100, after: null })
      if (failing) {
        throw new Error('private SQL and connection details')
      }

      return empty
    }
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()
  for (const [suffix, method] of [
    ['', 'HEAD'],
    ['&limit=0', 'GET'],
    ['&adventureName=x', 'GET']
  ]) {
    const response = await fetch(origin + url + suffix, { method })
    assert.equal(response.status, 400)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.match(response.headers.get('content-type') ?? '', /^application\/json/)
    assert.equal(response.headers.get('retry-after'), null)
    if (method === 'HEAD') {
      assert.equal(await response.text(), '')
    } else {
      assert.deepEqual(await response.json(), queryFailure.body)
    }
  }
  assert.equal(calls, 0)
  const response = await fetch(origin + url)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), empty)
  failing = true
  const failed = await fetch(origin + url)
  assert.equal(failed.status, 500)
  assert.equal(failed.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await failed.json(), internalFailure.body)
  failing = false
  for (let i = 0; i < 8; i++) {
    const success = await fetch(origin + url)
    assert.equal(success.status, 200)
    assert.deepEqual(await success.json(), empty)
  }
  const limited = await fetch(origin + url)
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await limited.json(), {
    error: {
      code: 'CHARACTER_RATE_LIMITED',
      message: '캐릭터 조회 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    }
  })
  const retryAfter = limited.headers.get('retry-after')
  assert.match(retryAfter ?? '', /^[1-9][0-9]*$/)
  const seconds = Number(retryAfter)
  assert(Number.isInteger(seconds) && seconds >= 1 && seconds <= 60)
  assert.equal(calls, 10)
})

test(
  '종료는 활성 모험단 읽기를 취소하고 정리를 기다리며 늦은 성공을 거절한다',
  { timeout: 2_000 },
  async (t) => {
    let entered!: () => void
    let finish!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    let readSignal: AbortSignal | undefined
    let calls = 0
    const service = createAdventureSearchService({
      search: async (_input, signal) => {
        calls++
        readSignal = signal
        entered()
        await pending

        return empty
      }
    })
    t.after(async () => {
      finish()
      await service.onModuleDestroy()
    })
    const rejected = assert.rejects(
      service.search('192.0.2.1', url, new AbortController().signal),
      internalFailure
    )
    await started
    let closed = false
    const closing = service.onModuleDestroy().then(() => {
      closed = true
    })
    assert(readSignal)
    assert.equal(readSignal.aborted, true)
    assert.equal(closed, false)
    finish()
    await rejected
    await closing
    assert.equal(closed, true)
    await assert.rejects(
      service.search('192.0.2.1', url, new AbortController().signal),
      internalFailure
    )
    assert.equal(calls, 1)
  }
)

test(
  'HTTP 연결 해제는 진행 중인 모험단 store 읽기로 취소 신호를 전달한다',
  { timeout: 2_000 },
  async (t) => {
    let entered!: () => void
    let markAborted!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const aborted = new Promise<void>((resolve) => {
      markAborted = resolve
    })
    let calls = 0
    let readSignal: AbortSignal | undefined
    const controller = new AbortController()
    const app = await createApiHttpApp({ apiKey: 'synthetic' }, undefined, {
      search: async (input, signal) => {
        calls++
        assert.deepEqual(input, { adventureName: '합성모험단', limit: 100, after: null })
        readSignal = signal
        entered()
        await new Promise<void>((resolve) => {
          signal.addEventListener(
            'abort',
            () => {
              markAborted()
              resolve()
            },
            { once: true }
          )
        })

        return empty
      }
    })
    t.after(async () => {
      controller.abort()
      await app.close()
    })
    await app.listen(0, '127.0.0.1')
    const rejected = assert.rejects(
      fetch((await app.getUrl()) + url, { signal: controller.signal }),
      { name: 'AbortError' }
    )
    await started
    assert(readSignal)
    assert.equal(readSignal.aborted, false)
    controller.abort()
    await rejected
    await aborted
    assert.equal(readSignal.aborted, true)
    assert.equal(calls, 1)
  }
)
