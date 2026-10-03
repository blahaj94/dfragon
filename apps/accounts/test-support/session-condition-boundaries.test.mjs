import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { rotateRefresh } from '../dist/auth/refresh/index.js'
import { logoutSession } from '../dist/auth/logout/index.js'
import { UserSchema } from '../dist/database/schemas/users.js'
import { AuthSessionSchema } from '../dist/database/schemas/auth-sessions.js'
import { AuthRefreshTokenSchema } from '../dist/database/schemas/auth-refresh-tokens.js'

const checkedAt = new Date('2026-09-06T00:00:00.000Z')
const cases = {
  refresh: 'refresh는 hint 뒤 사라지거나 소유가 바뀐 row로 발급·소비·폐기하지 않는다',
  logout: 'logout은 hint 뒤 사라지거나 소유가 바뀐 row를 폐기하지 않고 성공한다',
  unknown: '미발급 canonical hash로 기존 소비 이력의 session을 선택하거나 폐기하지 않는다'
}

function targetFixture() {
  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(Buffer.from(rawToken, 'base64url')).digest()
  const user = { id: randomUUID(), nickname: '현재 회원', createdAt: checkedAt }
  const otherUser = { id: randomUUID(), nickname: '다른 회원', createdAt: checkedAt }
  const session = {
    id: randomUUID(),
    userId: user.id,
    createdAt: checkedAt,
    lastActiveAt: checkedAt,
    revokedAt: null,
    revokedReason: null
  }
  const otherSession = { ...session, id: randomUUID(), userId: otherUser.id }
  const token = {
    tokenHash,
    sessionId: session.id,
    issuedAt: checkedAt,
    consumedAt: checkedAt
  }
  const rows = { users: [user, otherUser], sessions: [session, otherSession], refresh: [token] }
  const effects = { signed: 0, updated: [], inserted: [], committed: 0, rolledBack: 0 }
  let beforeUserLock = () => {}

  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (Buffer.isBuffer(value)) {
        return Buffer.isBuffer(row[key]) && row[key].equals(value)
      }

      return row[key] === value
    })
  }

  const repositories = new Map(
    [
      [UserSchema, rows.users],
      [AuthSessionSchema, rows.sessions],
      [AuthRefreshTokenSchema, rows.refresh]
    ].map(([schema, records]) => {
      const find = (where) => {
        const row = records.find((record) => matches(record, where))
        if (row == null) {
          return null
        }

        return { ...row }
      }
      const repository = {
        findOneBy: async (where) => find(where),
        findOne: async ({ where, lock }) => {
          assert.equal(lock.mode, 'pessimistic_write')
          if (schema === UserSchema) {
            beforeUserLock()
          }

          return find(where)
        },
        update: async (where, values) => {
          effects.updated.push({ schema: schema.options.name, where, values })
        },
        insert: async (value) => {
          effects.inserted.push({ schema: schema.options.name, value })
        }
      }

      return [schema, repository]
    })
  )
  const dataSource = {
    transaction: async (isolation, operation) => {
      assert.equal(isolation, 'READ COMMITTED')
      try {
        const result = await operation({
          getRepository(schema) {
            assert(repositories.has(schema))

            return repositories.get(schema)
          },
          query: async () => [{ now: checkedAt }]
        })
        effects.committed++

        return result
      } catch (error) {
        effects.rolledBack++
        throw error
      }
    }
  }
  const deps = {
    dataSource,
    issueAccessJwt: async () => {
      effects.signed++
      throw new Error('거절된 대상은 token을 발급할 수 없음')
    }
  }

  function transition(kind) {
    beforeUserLock = () => {
      if (kind === 'user-removed') {
        rows.users.splice(rows.users.indexOf(user), 1)
        rows.sessions.splice(rows.sessions.indexOf(session), 1)
        rows.refresh.splice(rows.refresh.indexOf(token), 1)
      } else if (kind === 'session-removed') {
        rows.sessions.splice(rows.sessions.indexOf(session), 1)
        rows.refresh.splice(rows.refresh.indexOf(token), 1)
      } else if (kind === 'token-removed') {
        rows.refresh.splice(rows.refresh.indexOf(token), 1)
      } else if (kind === 'session-owner') {
        session.userId = otherUser.id
      } else if (kind === 'token-owner') {
        token.sessionId = otherSession.id
      }
      beforeUserLock = () => {}
    }
  }

  return { rawToken, deps, rows, effects, transition }
}

for (const [operation, title] of [
  ['refresh', cases.refresh],
  ['logout', cases.logout]
]) {
  test(title, async (t) => {
    for (const [name, kind] of [
      ['회원 삭제와 FK cascade', 'user-removed'],
      ['session 삭제와 refresh cascade', 'session-removed'],
      ['제출한 refresh 이력 삭제', 'token-removed'],
      ['session을 다른 존재하는 회원으로 연결', 'session-owner'],
      ['소비된 refresh를 다른 존재하는 session으로 연결', 'token-owner']
    ]) {
      await t.test(name, async () => {
        const f = targetFixture()
        f.transition(kind)
        if (operation === 'refresh') {
          await assert.rejects(rotateRefresh(f.deps, f.rawToken), {
            code: 'AUTHENTICATION_REQUIRED',
            status: 401,
            message: '로그인이 필요합니다.'
          })
        } else {
          await logoutSession(f.deps.dataSource, f.rawToken)
        }
        assert.equal(f.effects.signed, 0)
        assert.deepEqual(f.effects.updated, [])
        assert.deepEqual(f.effects.inserted, [])
        assert.equal(f.effects.committed, operation === 'logout' ? 1 : 0)
        assert.equal(f.effects.rolledBack, operation === 'refresh' ? 1 : 0)
        for (const row of f.rows.sessions) {
          assert.equal(row.revokedAt, null)
          assert.equal(row.revokedReason, null)
          assert.equal(row.lastActiveAt, checkedAt)
        }
        for (const row of f.rows.refresh) {
          assert.equal(row.consumedAt, checkedAt)
          assert(Buffer.isBuffer(row.tokenHash))
        }
      })
    }
  })
}

test(cases.unknown, async () => {
  const f = targetFixture()
  const before = structuredClone(f.rows)
  for (const token of before.refresh) {
    token.tokenHash = Buffer.from(token.tokenHash)
  }
  const unknown = randomBytes(32).toString('base64url')
  await assert.rejects(rotateRefresh(f.deps, unknown), {
    code: 'AUTHENTICATION_REQUIRED',
    status: 401
  })
  await logoutSession(f.deps.dataSource, unknown)
  assert.deepEqual(f.rows, before)
  assert.deepEqual(f.effects, {
    signed: 0,
    updated: [],
    inserted: [],
    committed: 1,
    rolledBack: 1
  })
})
