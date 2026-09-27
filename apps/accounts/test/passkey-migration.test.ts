import assert from 'node:assert/strict'
import test from 'node:test'
import type { DataSource } from 'typeorm'
import { createPasskeyMigration } from '../src/auth/login/migration.js'
import { configurationFingerprint } from '../src/auth/login/configuration.js'
import { newOpaque, opaqueHash } from '../src/auth/login/crypto.js'
import { browserCookie } from '../src/auth/login/state.js'
import { CLEARED_LOGIN_FIELDS } from '../src/constants/login.js'
import { AuthLoginRequestSchema } from '../src/database/schemas/auth-login-requests.js'
import { PasskeyMigrationSchema } from '../src/database/schemas/passkey-migrations.js'
import { UserSchema } from '../src/database/schemas/users.js'
import { PasskeySchema } from '../src/database/schemas/passkeys.js'
import type { LoginDependencies } from '../src/types/login.js'

function fixture(expireDuringIdentityLock = false) {
  const configuration = {
    apiOrigin: 'https://accounts.example.test',
    rpId: 'accounts.example.test',
    rpName: 'DFRAGON',
    returnUrl: 'dfragon://auth/callback',
    legacyOrigin: 'https://api.example.test'
  }
  const id = '11111111-1111-4111-8111-111111111111'
  const now = new Date('2026-09-28T00:00:00Z'),
    deadline = new Date(now.getTime() + 60_000)
  const secret = newOpaque(),
    ticket = newOpaque()
  const row = {
    ...CLEARED_LOGIN_FIELDS,
    id,
    purpose: 'login',
    status: 'browser_started',
    configuration: configurationFingerprint(configuration),
    browserBindingHash: opaqueHash(secret),
    expiresAt: new Date(now.getTime() + 600_000)
  }
  const transfer = {
    requestId: id,
    phone: false,
    state: 'returning',
    sourceBindingHash: opaqueHash(secret),
    ticketHash: opaqueHash(ticket),
    ticketExpiresAt: deadline,
    userId: id,
    credentialId: 'synthetic',
    legacyBindingHash: null,
    challenge: null
  }
  let checkedAt = now,
    saves = 0
  const manager = {
    query: async () => [{ now: checkedAt }],
    getRepository: (schema: unknown) => {
      if (schema === AuthLoginRequestSchema) {
        return { findOne: async () => row }
      }
      if (schema === PasskeyMigrationSchema) {
        return {
          findOneBy: async () => transfer,
          findOne: async () => transfer,
          save: async () => {
            saves++
          }
        }
      }
      if (schema === UserSchema) {
        return {
          findOne: async () => {
            if (expireDuringIdentityLock) {
              checkedAt = deadline
            }
            return { id }
          }
        }
      }
      if (schema === PasskeySchema) {
        return { findOne: async () => ({ id: 'synthetic', userId: id, rpId: 'api.example.test' }) }
      }
      throw new Error('Unexpected repository')
    }
  }
  const dataSource = {
    transaction: async (_isolation: unknown, operation: (manager: unknown) => unknown) =>
      operation(manager)
  } as unknown as DataSource
  const deps: LoginDependencies = {
    dataSource,
    configuration,
    issueAccessJwt: async () => {
      throw new Error('Handoff cannot issue a session')
    }
  }
  const migration = createPasskeyMigration(deps, async () => {
    throw new Error('Handoff cannot complete login')
  })
  return {
    migration,
    ticket,
    cookie: browserCookie({ requestId: id, bindingValue: secret, maxAgeSeconds: 600 }).split(
      ';'
    )[0],
    state: () => transfer.state,
    saves: () => saves
  }
}

test('return ticket that expires while waiting for identity locks cannot be consumed', async () => {
  const f = fixture(true)
  await assert.rejects(f.migration.authorizeAccounts(f.ticket, f.cookie, 'accounts.example.test'), {
    code: 'LOGIN_REQUEST_INVALID'
  })
  assert.equal(f.saves(), 0)
  assert.equal(f.state(), 'returning')
})

test('a return ticket grants enrollment only to the original accounts cookie and only once', async () => {
  const f = fixture()
  await assert.rejects(f.migration.authorizeAccounts(f.ticket, '', 'accounts.example.test'), {
    code: 'LOGIN_REQUEST_INVALID'
  })
  const authorization = await f.migration.authorizeAccounts(
    f.ticket,
    f.cookie,
    'accounts.example.test'
  )
  assert.equal(authorization.migration, true)
  assert.equal(authorization.cookie, '')
  await assert.rejects(f.migration.authorizeAccounts(f.ticket, f.cookie, 'accounts.example.test'), {
    code: 'LOGIN_REQUEST_INVALID'
  })
  assert.equal(f.saves(), 1)
})
