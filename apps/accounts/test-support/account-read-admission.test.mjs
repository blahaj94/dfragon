import assert from 'node:assert/strict'
import test from 'node:test'
import { createLoginHttpApp } from '../dist/auth/login/http.js'
import { AUTH_ADMISSION } from '../dist/auth/login/admission.js'
import { AuthSessionSchema } from '../dist/database/schemas/auth-sessions.js'
import { UserSchema } from '../dist/database/schemas/users.js'

async function accountApp(t) {
  const counts = {
    verifications: 0,
    transactions: 0,
    users: 0,
    sessions: 0,
    clocks: 0,
    activity: 0
  }
  const sessionCalls = { refresh: 0, logout: 0 }
  const user = { id: '00000000-0000-4000-8000-000000000001', nickname: 'fixture' }
  const session = {
    id: '00000000-0000-4000-8000-000000000002',
    userId: user.id,
    lastActiveAt: new Date(Date.now() - 10_000),
    revokedAt: null
  }
  const tokens = {
    tokenType: 'Bearer',
    accessToken: 'fixture-access',
    accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    refreshToken: 'A'.repeat(43),
    sessionExpiresAt: new Date(Date.now() + 86_400_000).toISOString()
  }
  const manager = {
    getRepository(schema) {
      if (schema === UserSchema) {

        return {
          async findOne() {
            counts.users++

            return user
          }
        }
      }
      assert.equal(schema, AuthSessionSchema)

      return {
        async findOne() {
          counts.sessions++

          return session
        },
        async update(_where, values) {
          counts.activity++
          Object.assign(session, values)
        }
      }
    },
    async query() {
      counts.clocks++

      return [{ now: new Date() }]
    }
  }
  const unused = async () => {
    throw new Error('unrelated login service called')
  }
  const app = await createLoginHttpApp(
    { create: unused, authorize: unused, exchange: unused, manage: unused, browser: unused },
    {
      async refresh() {
        sessionCalls.refresh++

        return tokens
      },
      async logout() {
        sessionCalls.logout++
      }
    },
    {
      dataSource: {
        async transaction(_isolation, operation) {
          counts.transactions++

          return operation(manager)
        }
      },
      async verifyAccessJwt(token) {
        counts.verifications++
        if (token !== tokens.accessToken) {
          throw new Error('invalid synthetic token')
        }
        const now = Math.floor(Date.now() / 1000)

        return { userId: user.id, sessionId: session.id, issuedAt: now - 10, expiresAt: now + 900 }
      }
    }
  )
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')
  const base = await app.getUrl()

  return {
    counts,
    sessionCalls,
    user,
    session,
    read: (token = tokens.accessToken) =>
      fetch(`${base}/me`, { headers: { authorization: `Bearer ${token}` } }),
    post: (path) =>
      fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken })
      })
  }
}

test('OCR-sized account reads preserve live checks and the client refresh/logout allowance', async (t) => {
  const f = await accountApp(t)
  for (let i = 0; i < 180; i++) {
    const response = await f.read()
    assert.equal(response.status, 200, `account read ${i + 1}`)
    assert.deepEqual(await response.json(), { user: f.user })
  }
  assert.deepEqual(f.counts, {
    verifications: 180,
    transactions: 360,
    users: 360,
    sessions: 360,
    clocks: 360,
    activity: 180
  })

  const refresh = await f.post('/auth/refresh')
  assert.equal(refresh.status, 200)
  await refresh.arrayBuffer()
  const logout = await f.post('/auth/logout')
  assert.equal(logout.status, 204)
  await logout.arrayBuffer()
  assert.deepEqual(f.sessionCalls, { refresh: 1, logout: 1 })

  const invalid = await f.read('invalid')
  assert.equal(invalid.status, 401)
  assert.equal((await invalid.json()).error.code, 'AUTHENTICATION_REQUIRED')
  assert.equal(f.counts.transactions, 360)

  f.session.revokedAt = new Date()
  const revoked = await f.read()
  assert.equal(revoked.status, 401)
  assert.equal((await revoked.json()).error.code, 'AUTHENTICATION_REQUIRED')
  assert.equal(f.counts.verifications, 182)
  assert.equal(f.counts.transactions, 361)
  assert.equal(f.counts.activity, 180)
})

test('account reads remain available after the client session-request quota is exhausted', async (t) => {
  const f = await accountApp(t)
  for (let i = 0; i < AUTH_ADMISSION.perClient; i++) {
    const response = await f.post('/auth/logout')
    assert.equal(response.status, 204)
    await response.arrayBuffer()
  }
  const limited = await f.post('/auth/logout')
  assert.equal(limited.status, 429)
  await limited.arrayBuffer()
  assert.equal(f.sessionCalls.logout, AUTH_ADMISSION.perClient)

  const read = await f.read()
  assert.equal(read.status, 200)
  assert.deepEqual(await read.json(), { user: f.user })
  assert.equal(f.counts.verifications, 1)
  assert.equal(f.counts.transactions, 2)
})

test('account reads and session requests still consume the shared process quota', async (t) => {
  const f = await accountApp(t)
  const refresh = await f.post('/auth/refresh')
  assert.equal(refresh.status, 200)
  await refresh.arrayBuffer()
  for (let i = 0; i < AUTH_ADMISSION.total - 1; i++) {
    const response = await f.read()
    assert.equal(response.status, 200, `account read ${i + 1}`)
    await response.arrayBuffer()
  }
  const beforeLimit = { ...f.counts }
  for (const response of [await f.read(), await f.post('/auth/logout')]) {
    assert.equal(response.status, 429)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert(Number(response.headers.get('retry-after')) > 0)
    assert.equal((await response.json()).error.code, 'AUTH_RATE_LIMIT')
  }
  assert.deepEqual(f.counts, beforeLimit)
  assert.equal(f.counts.verifications, AUTH_ADMISSION.total - 1)
  assert.equal(f.counts.transactions, (AUTH_ADMISSION.total - 1) * 2)
  assert.deepEqual(f.sessionCalls, { refresh: 1, logout: 0 })
})
