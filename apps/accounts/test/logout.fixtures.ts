import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { DataSource } from 'typeorm'
import { UserSchema } from '../src/database/schemas/users.js'
import { AuthSessionSchema } from '../src/database/schemas/auth-sessions.js'
import { AuthRefreshTokenSchema } from '../src/database/schemas/auth-refresh-tokens.js'

export const checkedAt = new Date('2026-09-06T00:00:00.000Z')

export function rawRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

export function refreshTokenHash(rawToken: string): Buffer {
  return createHash('sha256').update(Buffer.from(rawToken, 'base64url')).digest()
}

type FixtureState = {
  tokenHintMissing: boolean
  sessionHintMissing: boolean
  userMissing: boolean
  sessionMissing: boolean
  tokenMissing: boolean
  freshTime: Date
  beforeLockedRead?: (kind: 'user' | 'session' | 'refresh') => void
  beforeCommit?: () => Promise<void>
  transactionFailure?: Error
  commitFailure?: Error
}

export function logoutFixture() {
  const rawToken = rawRefreshToken()
  const user = { id: randomUUID() }
  const session = {
    id: randomUUID(),
    userId: user.id,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    lastActiveAt: new Date('2026-09-05T00:00:00.000Z'),
    revokedAt: null as Date | null,
    revokedReason: null as 'logout' | 'refresh_reuse' | null
  }
  const otherUser = { id: randomUUID() }
  const otherSession = { ...session, id: randomUUID(), userId: otherUser.id }
  const token = {
    tokenHash: refreshTokenHash(rawToken),
    sessionId: session.id,
    issuedAt: new Date('2026-09-05T00:00:00.000Z'),
    consumedAt: null as Date | null
  }
  const state: FixtureState = {
    tokenHintMissing: false,
    sessionHintMissing: false,
    userMissing: false,
    sessionMissing: false,
    tokenMissing: false,
    freshTime: checkedAt
  }
  const events: string[] = []
  let revokeBefore: Pick<typeof session, 'revokedAt' | 'revokedReason'> | undefined

  const users = {
    findOne: async (query: { where: { id: string }; lock: unknown }) => {
      assert.deepEqual(query.lock, { mode: 'pessimistic_write' })
      events.push('user-lock')
      state.beforeLockedRead?.('user')
      const isUserMissing = state.userMissing

      const found = [user, otherUser].find((row) => row.id === query.where.id)
      if (isUserMissing || found == null) {
        return null
      }

      return { ...found }
    }
  }
  const sessions = {
    findOneBy: async (where: { id: string }) => {
      events.push('session-hint')
      const isSessionHintMissing = state.sessionHintMissing

      const found = [session, otherSession].find((row) => row.id === where.id)
      if (isSessionHintMissing || found == null) {
        return null
      }

      return { ...found }
    },
    findOne: async (query: { where: { id: string }; lock: unknown }) => {
      assert.deepEqual(query.lock, { mode: 'pessimistic_write' })
      events.push('session-lock')
      state.beforeLockedRead?.('session')
      const isSessionMissing = state.sessionMissing

      const found = [session, otherSession].find((row) => row.id === query.where.id)
      if (isSessionMissing || found == null) {
        return null
      }

      return { ...found }
    },
    update: async (criteria: unknown, update: { revokedAt: Date; revokedReason: 'logout' }) => {
      assert.deepEqual(criteria, { id: session.id })
      assert.deepEqual(update, { revokedAt: state.freshTime, revokedReason: 'logout' })
      events.push('revoke')
      revokeBefore = { revokedAt: session.revokedAt, revokedReason: session.revokedReason }
      session.revokedAt = update.revokedAt
      session.revokedReason = update.revokedReason
    }
  }
  const refresh = {
    findOneBy: async (where: { tokenHash: Buffer }) => {
      events.push('refresh-hint')
      const isTokenHintMissing = state.tokenHintMissing

      if (isTokenHintMissing || !where.tokenHash.equals(token.tokenHash)) {
        return null
      }

      return { ...token }
    },
    findOne: async (query: { where: { tokenHash: Buffer }; lock: unknown }) => {
      assert.deepEqual(query, {
        where: { tokenHash: refreshTokenHash(rawToken) },
        lock: { mode: 'pessimistic_write' }
      })
      events.push('refresh-lock')
      state.beforeLockedRead?.('refresh')
      const isTokenMissing = state.tokenMissing

      if (isTokenMissing || !query.where.tokenHash.equals(token.tokenHash)) {
        return null
      }

      return { ...token }
    }
  }
  const manager = {
    getRepository: (schema: unknown) => {
      const isUserSchema = schema === UserSchema
      if (isUserSchema) {
        return users
      }
      const isSessionSchema = schema === AuthSessionSchema
      if (isSessionSchema) {
        return sessions
      }

      assert.equal(schema, AuthRefreshTokenSchema)

      return refresh
    },
    query: async (sql: string) => {
      assert.equal(sql, 'SELECT to_timestamp(floor(extract(epoch from clock_timestamp()))) AS now')
      events.push('fresh-time')

      return [{ now: state.freshTime }]
    }
  }
  const dataSource = {
    transaction: async (
      isolation: string,
      operation: (transactionManager: typeof manager) => Promise<void>
    ) => {
      assert.equal(isolation, 'READ COMMITTED')
      events.push('begin')
      revokeBefore = undefined
      try {
        if (state.transactionFailure != null) {
          throw state.transactionFailure
        }
        await operation(manager)
        await state.beforeCommit?.()
        if (state.commitFailure != null) {
          throw state.commitFailure
        }
        events.push('commit')
      } catch (error) {
        // 대기 중 다른 transaction이 바꾼 소유, 활동은 보존하고 이 logout의 쓰기만 되돌린다.
        if (revokeBefore !== undefined) {
          Object.assign(session, revokeBefore)
        }
        events.push('rollback')
        throw error
      }
    }
  } as unknown as DataSource

  return { dataSource, events, rawToken, session, state, token, user, otherUser, otherSession }
}
