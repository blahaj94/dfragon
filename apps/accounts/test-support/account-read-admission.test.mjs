import assert from 'node:assert/strict'
import test from 'node:test'
import { createLoginHttpApp } from '../dist/auth/login/http.js'
import { AuthSessionSchema } from '../dist/database/schemas/auth-sessions.js'
import { UserSchema } from '../dist/database/schemas/users.js'

// 2026-10-20에 없앤 요청 횟수 한도다. 제품 상수를 기대값으로 가져오지 않는다.
const formerClientLimit = 120
const formerProcessLimit = 1200
const cases = {
  live: '180회 계정 조회도 매번 활성 상태를 확인하고 refresh, logout 예산을 보존한다',
  client: 'session 요청이 예전 client 한도 120회를 넘어도 거절하지 않는다',
  process: '계정 조회와 session 요청이 예전 전체 한도 1,200회를 넘어도 거절하지 않는다',
  invalid:
    '무효 token의 계정 조회가 예전 전체 한도 1,200회를 넘어도 계속 401이며 DB 활동은 남기지 않는다'
}

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
    createdAt: new Date(Math.floor(Date.now() / 1000) * 1000 - 10_000),
    lastActiveAt: new Date(Math.floor(Date.now() / 1000) * 1000 - 10_000),
    revokedAt: null,
    revokedReason: null
  }
  const tokens = {
    tokenType: 'Bearer',
    accessToken: 'fixture-access',
    accessTokenExpiresAt: new Date(Math.floor(Date.now() / 1000) * 1000 + 890_000).toISOString(),
    refreshToken: 'A'.repeat(43),
    sessionExpiresAt: new Date(session.lastActiveAt.getTime() + 2_592_000_000).toISOString()
  }
  const manager = {
    getRepository(schema) {
      if (schema === UserSchema) {
        return {
          async findOne({ where, lock }) {
            counts.users++
            assert.deepEqual(lock, { mode: 'pessimistic_write' })
            if (where.id !== user.id) {
              return null
            }

            return { ...user }
          }
        }
      }
      assert.equal(schema, AuthSessionSchema)

      return {
        async findOne({ where, lock }) {
          counts.sessions++
          assert.deepEqual(lock, { mode: 'pessimistic_write' })
          if (where.id !== session.id || where.userId !== session.userId) {
            return null
          }

          return { ...session }
        },
        async update(where, values) {
          assert.deepEqual(where, { id: session.id })
          counts.activity++
          Object.assign(session, values)
        }
      }
    },
    async query() {
      counts.clocks++
      const now = new Date(Math.floor(Date.now() / 1000) * 1000)

      return [{ now }]
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
        async transaction(isolation, operation) {
          assert.equal(isolation, 'READ COMMITTED')
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
        const userId = user.id
        const sessionId = session.id
        const issuedAt = now - 10
        const expiresAt = issuedAt + 900

        return { userId, sessionId, issuedAt, expiresAt }
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

test(cases.live, async (t) => {
  const f = await accountApp(t)
  for (let i = 0; i < 180; i++) {
    const response = await f.read()
    assert.equal(response.status, 200, `계정 조회 ${i + 1}`)
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

  f.session.revokedAt = new Date(Math.floor(Date.now() / 1000) * 1000)
  f.session.revokedReason = 'logout'
  const revoked = await f.read()
  assert.equal(revoked.status, 401)
  assert.equal((await revoked.json()).error.code, 'AUTHENTICATION_REQUIRED')
  assert.equal(f.counts.verifications, 182)
  assert.equal(f.counts.transactions, 361)
  assert.equal(f.counts.activity, 180)
})

test(cases.client, async (t) => {
  const f = await accountApp(t)
  const requestCount = formerClientLimit + 1
  for (let i = 0; i < requestCount; i++) {
    const response = await f.post('/auth/logout')
    assert.equal(response.status, 204, `logout ${i + 1}`)
    await response.arrayBuffer()
  }
  assert.equal(f.sessionCalls.logout, requestCount)

  const read = await f.read()
  assert.equal(read.status, 200)
  assert.deepEqual(await read.json(), { user: f.user })
  assert.equal(f.counts.verifications, 1)
  assert.equal(f.counts.transactions, 2)
})

test(cases.process, async (t) => {
  const f = await accountApp(t)
  const refresh = await f.post('/auth/refresh')
  assert.equal(refresh.status, 200)
  await refresh.arrayBuffer()
  const readCount = formerProcessLimit
  for (let i = 0; i < readCount; i++) {
    const response = await f.read()
    assert.equal(response.status, 200, `계정 조회 ${i + 1}`)
    await response.arrayBuffer()
  }
  const logout = await f.post('/auth/logout')
  assert.equal(logout.status, 204)
  await logout.arrayBuffer()
  assert.equal(f.counts.verifications, readCount)
  assert.equal(f.counts.transactions, readCount * 2)
  assert.deepEqual(f.sessionCalls, { refresh: 1, logout: 1 })
})

test(cases.invalid, async (t) => {
  const f = await accountApp(t)
  const beforeSession = structuredClone(f.session)
  const requestCount = formerProcessLimit + 1
  for (let i = 0; i < requestCount; i++) {
    const response = await f.read('invalid-token-canary')
    assert.equal(response.status, 401, `무효 token 조회 ${i + 1}`)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), {
      error: { code: 'AUTHENTICATION_REQUIRED', message: '로그인이 필요합니다.' }
    })
  }
  assert.deepEqual(f.session, beforeSession)
  assert.deepEqual(f.counts, {
    verifications: requestCount,
    transactions: 0,
    users: 0,
    sessions: 0,
    clocks: 0,
    activity: 0
  })
  assert.deepEqual(f.sessionCalls, { refresh: 0, logout: 0 })
})
