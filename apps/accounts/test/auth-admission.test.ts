import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { createLoginHttpApp } from '../src/auth/login/http.js'
import { AUTH_ADMISSION } from '../src/auth/login/admission.js'

test('refresh, logout, exchange and authorization share the IPv6-prefix authentication quota', async (t) => {
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
  for (let i = 0; i <= AUTH_ADMISSION.perClient; i++) {
    const route = routes[i % routes.length]!
    const response = await fetch(base + route.path, {
      method: route.body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `2001:db8:1:2::${(i + 1).toString(16)}`
      },
      body: route.body === undefined ? undefined : JSON.stringify(route.body)
    })
    assert.equal(response.status, i < AUTH_ADMISSION.perClient ? 500 : 429)
    if (response.status === 429) {
      assert(Number(response.headers.get('Retry-After')) > 0)
    }
    await response.arrayBuffer()
  }
  assert.equal(calls, AUTH_ADMISSION.perClient)
  const other = await fetch(base + '/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '2001:db8:1:3::1' },
    body: JSON.stringify({ refreshToken: token })
  })
  assert.equal(other.status, 500)
  await other.arrayBuffer()
  assert.equal(calls, AUTH_ADMISSION.perClient + 1)
})

test('service concurrency is bounded through disconnects and recovered after completion', async (t) => {
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
    if (calls === AUTH_ADMISSION.concurrent) {
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
  const requests = Array.from({ length: AUTH_ADMISSION.concurrent }, () =>
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
  assert.equal(calls, AUTH_ADMISSION.concurrent)
  release()
  await nextTurn()
  const recovered = await fetch(url, options)
  assert.equal(recovered.status, 500)
  await recovered.arrayBuffer()
  assert.equal(calls, AUTH_ADMISSION.concurrent + 1)
})
