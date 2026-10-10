import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { DataSource, EntityManager } from 'typeorm'
import { createLoginService } from '../src/auth/login/service.js'
import { configurationFingerprint } from '../src/auth/login/configuration.js'
import { newOpaque, opaqueHash } from '../src/auth/login/crypto.js'
import { browserCookie } from '../src/auth/login/state.js'
import {
  AuthLoginRequestSchema,
  type AuthLoginRequest
} from '../src/database/schemas/auth-login-requests.js'
import { PasskeySchema, type Passkey } from '../src/database/schemas/passkeys.js'
import { UserSchema } from '../src/database/schemas/users.js'

export function managementFixture(count = 2) {
  const now = new Date('2026-10-01T12:00:00Z')
  const configuration = {
    apiOrigin: 'https://auth.example.test',
    rpId: 'auth.example.test',
    rpName: 'DFragon',
    returnUrl: 'dfragon://auth/callback'
  }
  const secret = newOpaque()
  const userId = randomUUID()
  const keys: Passkey[] = Array.from({ length: count }, (_, index) => {
    const id = Buffer.from('credential-' + index).toString('base64url')

    return {
      id,
      userId,
      rpId: configuration.rpId,
      publicKey: Buffer.from([1]),
      counter: 0,
      transports: [],
      backedUp: false,
      deviceType: 'singleDevice',
      createdAt: now,
      lastUsedAt: null
    }
  })
  const row: AuthLoginRequest = {
    codeChallenge: null,
    launchTicketHash: null,
    webauthnChallenge: null,
    operation: null,
    pendingUserId: null,
    exchangeCodeHash: null,
    codeExpiresAt: null,
    id: randomUUID(),
    purpose: 'manage',
    status: 'managing',
    configuration: configurationFingerprint(configuration),
    createdAt: now,
    expiresAt: new Date(now.getTime() + 600_000),
    browserBindingHash: opaqueHash(secret),
    verifiedUserId: userId,
    credentialId: keys[0]!.id,
    isNewUser: false,
    consumedAt: null
  }
  const events: string[] = []
  let clockReads = 0
  const state: {
    onClock: (read: number) => Date
    beforeLockedRead: (kind: 'request' | 'user' | 'credential') => void
  } = {
    onClock: () => now,
    beforeLockedRead: () => {}
  }
  const currentKeys = () =>
    keys.filter((key) => key.userId === userId && key.rpId === configuration.rpId)
  const requests = {
    async findOne(query: unknown) {
      assert.deepEqual(query, { where: { id: row.id }, lock: { mode: 'pessimistic_write' } })
      events.push('request-lock')
      state.beforeLockedRead('request')

      return row
    },
    async update(where: unknown, values: Partial<AuthLoginRequest>) {
      assert.deepEqual(where, { id: row.id })
      events.push('request-update')
      Object.assign(row, values)
    },
    async save(value: AuthLoginRequest) {
      events.push('request-save')
      Object.assign(row, value)

      return row
    }
  }
  const credentials = {
    async findOne(query: { where: { id: string; userId: string; rpId: string }; lock: unknown }) {
      assert.deepEqual(query.lock, { mode: 'pessimistic_write' })
      assert.equal(query.where.userId, userId)
      assert.equal(query.where.rpId, configuration.rpId)
      events.push('credential-lock')
      state.beforeLockedRead('credential')
      const key = currentKeys().find((key) => key.id === query.where.id)

      if (key === undefined) {
        return null
      }

      return key
    },
    async find(query: unknown) {
      assert.deepEqual(query, {
        where: { userId, rpId: configuration.rpId },
        order: { createdAt: 'ASC', id: 'ASC' }
      })
      events.push('credential-list')
      const sorted = currentKeys().toSorted((left, right) => {
        const byCreation = left.createdAt.getTime() - right.createdAt.getTime()
        if (byCreation !== 0) {
          return byCreation
        }

        if (left.id < right.id) {
          return -1
        }

        if (left.id > right.id) {
          return 1
        }

        return 0
      })

      return sorted
    },
    async findBy(where: unknown) {
      assert.deepEqual(where, { userId, rpId: configuration.rpId })
      events.push('credential-list')

      return currentKeys()
    },
    async countBy(where: unknown) {
      assert.deepEqual(where, { userId, rpId: configuration.rpId })
      events.push('credential-count')

      return currentKeys().length
    },
    async insert(key: Passkey) {
      events.push('credential-insert')
      keys.push(key)
    },
    async delete(where: { id: string; userId: string }) {
      assert.equal(where.userId, userId)
      events.push('credential-delete')
      keys.splice(
        keys.findIndex((key) => key.id === where.id),
        1
      )
    }
  }
  // 조회와 상태 변경만 모델링하며 실제 PostgreSQL 경합은 DB 통합 테스트에서 확인한다.
  const manager = {
    getRepository(schema: unknown) {
      if (schema === AuthLoginRequestSchema) {
        return requests
      }

      if (schema === PasskeySchema) {
        return credentials
      }
      assert.equal(schema, UserSchema)

      return {
        async findOne(query: unknown) {
          assert.deepEqual(query, { where: { id: userId }, lock: { mode: 'pessimistic_write' } })
          events.push('user-lock')
          state.beforeLockedRead('user')

          return { id: userId }
        }
      }
    },
    async query(sql: string) {
      assert.equal(sql, 'SELECT to_timestamp(floor(extract(epoch from clock_timestamp()))) AS now')
      events.push('time')

      clockReads += 1
      const checkedAt = state.onClock(clockReads)

      return [{ now: checkedAt }]
    }
  } as unknown as EntityManager
  const dataSource = {
    isInitialized: true,
    options: { logging: false },
    async transaction<T>(isolation: string, operation: (manager: EntityManager) => Promise<T>) {
      assert.equal(isolation, 'READ COMMITTED')
      events.push('begin')
      try {
        const value = await operation(manager)
        events.push('commit')

        return value
      } catch (error) {
        events.push('rollback')
        throw error
      }
    }
  } as unknown as DataSource
  const service = createLoginService({
    dataSource,
    configuration,
    issueAccessJwt: async () => {
      throw new Error('not used')
    }
  })
  const cookie = browserCookie({ requestId: row.id, bindingValue: secret, maxAgeSeconds: 600 })
  const invoke = (
    action: string,
    values: Record<string, unknown> = {},
    boundary: { cookie?: string; origin?: string } = {}
  ) => {
    const requestCookie = boundary.cookie ?? cookie
    const origin = boundary.origin ?? configuration.apiOrigin

    return service.browser(action, { requestId: row.id, ...values }, requestCookie, origin)
  }

  return { invoke, service, cookie, row, keys, now, events, configuration, state }
}
