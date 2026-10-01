import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { DataSource, EntityManager } from 'typeorm'
import { createLoginService } from '../src/auth/login/service.js'
import { configurationFingerprint } from '../src/auth/login/configuration.js'
import { newOpaque, opaqueHash } from '../src/auth/login/crypto.js'
import { browserCookie } from '../src/auth/login/state.js'
import { CLEARED_LOGIN_FIELDS } from '../src/constants/login.js'
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
    rpName: 'DFRAGON',
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
    ...CLEARED_LOGIN_FIELDS,
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
  const requests = {
    async findOne(query: unknown) {
      assert.deepEqual(query, { where: { id: row.id }, lock: { mode: 'pessimistic_write' } })
      events.push('request-lock')

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
      const key = keys.find((key) => key.id === query.where.id)

      if (key === undefined) {
        return null
      }

      return key
    },
    async findBy(where: unknown) {
      assert.deepEqual(where, { userId, rpId: configuration.rpId })
      events.push('credential-list')

      return [...keys]
    },
    async countBy(where: unknown) {
      assert.deepEqual(where, { userId, rpId: configuration.rpId })
      events.push('credential-count')

      return keys.length
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
  // This service fixture models only used repositories; real lock/rollback behavior stays in DB tests.
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

          return { id: userId }
        }
      }
    },
    async query(sql: string) {
      assert.equal(sql, 'SELECT to_timestamp(floor(extract(epoch from clock_timestamp()))) AS now')
      events.push('time')

      return [{ now }]
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
  const invoke = (action: string, values: Record<string, unknown> = {}) =>
    service.browser(action, { requestId: row.id, ...values }, cookie, configuration.apiOrigin)

  return { invoke, row, keys, now, events }
}
