import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'

export const checkedAt = new Date('2026-09-08T00:00:00Z')
export const idleMilliseconds = 2_592_000_000

// 후보는 일부러 활성 row도 반환한다. 삭제 권한은 잠금 뒤 재판정에서만 생긴다.
export function cleanupFixture({
  sessions = [],
  requests = [],
  beforeLock,
  beforeCommit,
  afterCommit
} = {}) {
  const events = []
  const deleted = { sessions: [], requests: [] }
  let commits = 0
  const source = {
    query: async (sql) => {
      const isSessionQuery = sql.includes('auth_sessions')
      const isRequestQuery = sql.includes('auth_login_requests')
      const isCleanupQuery = isSessionQuery || isRequestQuery
      assert(isCleanupQuery)
      const rows = isSessionQuery ? sessions : requests

      return rows.map((row) => ({ ...row, user_id: row.userId }))
    },
    transaction: async (isolation, operation) => {
      assert.equal(isolation, 'READ COMMITTED')
      const pending = []
      let locked = false
      const manager = {
        query: async (sql) => {
          assert.match(sql, /clock_timestamp\(\)/)
          assert.match(sql, /floor\(/)
          assert.equal(locked, true, 'clock must be read after row lock')
          events.push('fresh-time')

          return [{ now: checkedAt }]
        },
        getRepository: (schema) => {
          const isSession = schema.options.tableName === 'auth_sessions'
          const rows = isSession ? sessions : requests
          const kind = isSession ? 'sessions' : 'requests'

          return {
            findOne: async (options) => {
              assert.equal(options.lock.mode, 'pessimistic_write')
              events.push('lock')
              locked = true
              await beforeLock?.(rows, options.where.id)

              const row = rows.find((row) => row.id === options.where.id)
              if (row == null) {
                return null
              }

              return row
            },
            delete: async (where) => {
              const isDirectId = typeof where === 'string'
              const id = isDirectId ? where : where.id
              pending.push([kind, id])

              return { affected: 1 }
            }
          }
        }
      }
      const result = await operation(manager)
      commits++
      await beforeCommit?.(commits)
      for (const [kind, id] of pending) {
        deleted[kind].push(id)
      }
      events.push('commit')
      await afterCommit?.()

      return result
    }
  }

  return { source, deleted, events }
}

export function session(patch = {}) {
  const id = randomUUID()
  const userId = randomUUID()
  const createdAt = new Date('2026-01-01T00:00:00Z')

  return {
    id,
    userId,
    createdAt,
    lastActiveAt: checkedAt,
    revokedAt: null,
    revokedReason: null,
    ...patch
  }
}

export function request(patch = {}) {
  const id = randomUUID()
  const status = patch.status ?? 'browser_started'
  const createdAt = new Date(checkedAt.getTime() - 540_000)
  const expiresAt = new Date(checkedAt.getTime() + 60_000)
  const row = {
    id,
    purpose: 'login',
    configuration: 'a'.repeat(64),
    createdAt,
    expiresAt,
    status,
    codeChallenge: null,
    launchTicketHash: null,
    browserBindingHash: null,
    webauthnChallenge: null,
    operation: null,
    pendingUserId: null,
    verifiedUserId: null,
    credentialId: null,
    isNewUser: false,
    exchangeCodeHash: null,
    codeExpiresAt: null,
    consumedAt: null
  }
  if (status === 'created') {
    row.codeChallenge = randomBytes(32).toString('base64url')
    row.launchTicketHash = randomBytes(32)
  }

  if (status === 'browser_started' || status === 'managing') {
    row.browserBindingHash = randomBytes(32)
    if (status === 'browser_started') {
      row.codeChallenge = randomBytes(32).toString('base64url')
    } else {
      row.purpose = 'manage'
      row.verifiedUserId = randomUUID()
      row.credentialId = 'cleanup-management-credential'
    }
  }

  if (status === 'exchange_ready') {
    row.codeChallenge = randomBytes(32).toString('base64url')
    row.verifiedUserId = randomUUID()
    row.credentialId = 'cleanup-exchange-credential'
    row.exchangeCodeHash = randomBytes(32)
    row.codeExpiresAt = expiresAt
  }

  if (status === 'consumed') {
    row.consumedAt = checkedAt
  }

  return { ...row, ...patch }
}
