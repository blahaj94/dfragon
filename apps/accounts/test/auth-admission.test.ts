import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { createLoginHttpApp } from '../src/auth/login/http.js'

// 2026-10-20에 없앤 60초 client 예산과 process 동시 실행 한도.
const FORMER_CLIENT_LIMIT = 120
const SERVICE_LIMIT = 32

test('IPv6 /64 대역과 IPv4 client의 인증 요청을 예전 한도 120회보다 많이 보내도 거절하지 않는다', async (t) => {
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
  const requestCount = FORMER_CLIENT_LIMIT * 2
  for (let i = 0; i < requestCount; i++) {
    const route = routes[i % routes.length]!
    const response = await fetch(base + route.path, {
      method: route.body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': i % 2 === 0 ? `2001:db8:1:2::${(i + 1).toString(16)}` : '192.0.2.5'
      },
      body: route.body === undefined ? undefined : JSON.stringify(route.body)
    })
    assert.equal(response.status, 500, `요청 ${i + 1}`)
    await response.arrayBuffer()
  }
  assert.equal(calls, requestCount)
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
