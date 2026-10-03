import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { createLoginHttpApp } from '../src/auth/login/http.js'

// 패스키 제품 계약의 60초 client 예산과 process 전체 실행 한도.
const CLIENT_LIMIT = 120
const SERVICE_LIMIT = 32

test('refresh·logout·exchange·인증 진입은 IPv6 /64 대역의 인증 예산 120회를 공유한다', async (t) => {
  let calls = 0
  const unavailable = async (): Promise<never> => {
    calls++
    throw new Error('synthetic unavailable')
  }
  const app = await createLoginHttpApp(
    {
      create: unavailable,
      authorize: unavailable,
      exchange: unavailable,
      manage: unavailable,
      browser: unavailable
    },
    { refresh: unavailable, logout: unavailable },
    undefined,
    { trustedProxyHops: 1 }
  )
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const base = await app.getUrl()
  const token = 'A'.repeat(43)
  const routes = [
    { path: '/auth/refresh', body: { refreshToken: token } },
    { path: '/auth/logout', body: { refreshToken: token } },
    {
      path: '/auth/exchange',
      body: { requestId: randomUUID(), clientId: 'desktop', code: token, codeVerifier: token }
    },
    { path: `/auth/login/authorize?ticket=${token}`, body: undefined }
  ]
  for (let i = 0; i <= CLIENT_LIMIT; i++) {
    const route = routes[i % routes.length]!
    const response = await fetch(base + route.path, {
      method: route.body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `2001:db8:1:2::${(i + 1).toString(16)}`
      },
      body: route.body === undefined ? undefined : JSON.stringify(route.body)
    })
    assert.equal(response.status, i < CLIENT_LIMIT ? 500 : 429)
    if (response.status === 429) {
      assert(Number(response.headers.get('Retry-After')) > 0)
      assert.deepEqual(await response.json(), {
        error: {
          code: 'AUTH_RATE_LIMIT',
          message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
        }
      })
    } else {
      await response.arrayBuffer()
    }
  }
  assert.equal(calls, CLIENT_LIMIT)
  const other = await fetch(base + '/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '2001:db8:1:3::1' },
    body: JSON.stringify({ refreshToken: token })
  })
  assert.equal(other.status, 500)
  await other.arrayBuffer()
  assert.equal(calls, CLIENT_LIMIT + 1)
})

test('연결이 끊겨도 실행 중인 service 한도 32개를 유지하고 실제 완료 뒤 슬롯을 반환한다', async (t) => {
  let entered!: () => void
  const allEntered = new Promise<void>((resolve) => {
    entered = resolve
  })
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let calls = 0
  const refresh = async (): Promise<never> => {
    calls++
    if (calls === SERVICE_LIMIT) {
      entered()
    }
    await gate
    throw new Error('synthetic unavailable')
  }
  const unused = async (): Promise<never> => {
    throw new Error('unused')
  }
  const app = await createLoginHttpApp(
    { create: unused, authorize: unused, exchange: unused, manage: unused, browser: unused },
    { refresh, logout: unused }
  )
  t.after(async () => {
    release()
    await app.close()
  })
  await app.listen(0, '127.0.0.1')
  const url = (await app.getUrl()) + '/auth/refresh'
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: 'A'.repeat(43) })
  }
  const disconnect = new AbortController()
  const requests = Array.from({ length: SERVICE_LIMIT }, () =>
    fetch(url, { ...options, signal: disconnect.signal }).catch(() => undefined)
  )
  await allEntered
  const saturated = await fetch(url, options)
  assert.equal(saturated.status, 429)
  await saturated.arrayBuffer()
  disconnect.abort()
  await Promise.all(requests)
  await nextTurn()
  const stillActive = await fetch(url, options)
  assert.equal(stillActive.status, 429)
  await stillActive.arrayBuffer()
  assert.equal(calls, SERVICE_LIMIT)
  release()
  await nextTurn()
  const recovered = await fetch(url, options)
  assert.equal(recovered.status, 500)
  await recovered.arrayBuffer()
  assert.equal(calls, SERVICE_LIMIT + 1)
})

test('신뢰 proxy의 IPv4와 IPv4-mapped IPv6는 동일 client 예산을 공유한다', async (t) => {
  let calls = 0
  const unavailable = async (): Promise<never> => {
    calls++
    throw new Error('synthetic unavailable')
  }
  const app = await createLoginHttpApp(
    {
      create: unavailable,
      authorize: unavailable,
      exchange: unavailable,
      manage: unavailable,
      browser: unavailable
    },
    { refresh: unavailable, logout: unavailable },
    undefined,
    { trustedProxyHops: 1 }
  )
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const base = await app.getUrl()
  const request = (ip: string) =>
    fetch(base + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ refreshToken: 'A'.repeat(43) })
    })
  for (let i = 0; i < CLIENT_LIMIT; i++) {
    const ip = i % 2 === 0 ? '192.0.2.5' : '::ffff:192.0.2.5'
    const response = await request(ip)
    assert.equal(response.status, 500)
    await response.arrayBuffer()
  }
  for (const ip of ['192.0.2.5', '::ffff:192.0.2.5']) {
    const limited = await request(ip)
    assert.equal(limited.status, 429)
    assert(Number(limited.headers.get('Retry-After')) > 0)
    await limited.arrayBuffer()
  }
  assert.equal(calls, CLIENT_LIMIT)
  const other = await request('192.0.2.6')
  assert.equal(other.status, 500)
  await other.arrayBuffer()
  assert.equal(calls, CLIENT_LIMIT + 1)
})
