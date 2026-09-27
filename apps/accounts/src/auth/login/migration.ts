import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import type { EntityManager } from 'typeorm'
import { AuthLoginRequestSchema } from '../../database/schemas/auth-login-requests.js'
import type { AuthLoginRequest } from '../../database/schemas/auth-login-requests.js'
import { PasskeyMigrationSchema } from '../../database/schemas/passkey-migrations.js'
import type { PasskeyMigration } from '../../database/schemas/passkey-migrations.js'
import { PasskeySchema } from '../../database/schemas/passkeys.js'
import { UserSchema } from '../../database/schemas/users.js'
import { LOGIN_ERRORS } from '../../constants/login.js'
import { LoginFailure } from '../../errors/login.js'
import type { LoginAuthorization, LoginDependencies } from '../../types/login.js'
import { UUID_PATTERN } from '../access-jwt/constants.js'
import { configuredLoginClient } from './configuration.js'
import { decodeOpaque, equalHash, newOpaque, opaqueHash } from './crypto.js'
import { requireExactFields } from './input.js'
import {
  browserCookie,
  cookieMatches,
  freshTime,
  loginTransaction,
  markLoginRequestFailed,
  requestExpired
} from './state.js'

const invalid = () => new LoginFailure(LOGIN_ERRORS.REQUEST_INVALID)
const badPasskey = () => new LoginFailure(LOGIN_ERRORS.PASSKEY)
type Complete = (
  manager: EntityManager,
  row: AuthLoginRequest,
  userId: string,
  credentialId: string
) => Promise<unknown>

/** The old RP proves identity; only the original accounts cookie can enroll a new RP key. */
export function createPasskeyMigration(deps: LoginDependencies, complete: Complete) {
  const config = deps.configuration
  const legacyOrigin = config.legacyOrigin
  const legacyRpId = legacyOrigin === undefined ? undefined : new URL(legacyOrigin).hostname
  const actions = [
    'legacy-start',
    'phone-legacy-start',
    'legacy-options',
    'legacy-verify',
    'legacy-cancel',
    'migration-options',
    'migration-verify',
    'migration-skip'
  ]

  async function current(manager: EntityManager, id: string) {
    const row = await manager
      .getRepository(AuthLoginRequestSchema)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } })
    if (
      legacyOrigin === undefined ||
      row === null ||
      row.status !== 'browser_started' ||
      configuredLoginClient(config, row.configuration) === null ||
      requestExpired(row, await freshTime(manager))
    ) {
      throw invalid()
    }
    return row
  }

  async function transferFor(manager: EntityManager, row: AuthLoginRequest) {
    const transfer = await manager
      .getRepository(PasskeyMigrationSchema)
      .findOne({ where: { requestId: row.id }, lock: { mode: 'pessimistic_write' } })
    const binding = transfer?.phone ? row.phoneBindingHash : row.browserBindingHash
    if (transfer === null || binding == null || !equalHash(transfer.sourceBindingHash, binding)) {
      throw invalid()
    }
    return transfer
  }

  async function requireIdentity(manager: EntityManager, transfer: PasskeyMigration) {
    if (transfer.userId === null || transfer.credentialId === null) {
      throw invalid()
    }
    const user = await manager
      .getRepository(UserSchema)
      .findOne({ where: { id: transfer.userId }, lock: { mode: 'pessimistic_write' } })
    const key = await manager.getRepository(PasskeySchema).findOne({
      where: { id: transfer.credentialId, userId: transfer.userId },
      lock: { mode: 'pessimistic_write' }
    })
    if (user === null || key === null || key.rpId !== legacyRpId) {
      throw invalid()
    }
    return { user, key }
  }

  function page(row: AuthLoginRequest, phone: boolean): LoginAuthorization {
    return {
      requestId: row.id,
      purpose: row.purpose,
      cookie: '',
      ...(phone ? { view: 'phone', confirmationCode: row.confirmationCode! } : {}),
      webReturnUrl:
        configuredLoginClient(config, row.configuration) === 'ocr' ? config.ocrReturnUrl : undefined
    }
  }

  async function authorize(
    ticket: string,
    cookie: string,
    host: string | undefined,
    legacy: boolean
  ) {
    decodeOpaque(ticket)
    const expectedOrigin = legacy ? legacyOrigin : config.apiOrigin
    if (expectedOrigin === undefined || host !== new URL(expectedOrigin).host) {
      throw invalid()
    }
    return loginTransaction(deps.dataSource, async (manager) => {
      // Find the parent, then acquire every lock in request → transfer → user → credential order.
      const hint = await manager
        .getRepository(PasskeyMigrationSchema)
        .findOneBy({ ticketHash: opaqueHash(ticket) })
      if (hint === null) {
        throw invalid()
      }
      const row = await current(manager, hint.requestId)
      const transfer = await transferFor(manager, row)
      const now = await freshTime(manager)
      if (
        transfer.state !== (legacy ? 'departing' : 'returning') ||
        !equalHash(transfer.ticketHash, opaqueHash(ticket)) ||
        transfer.ticketExpiresAt === null ||
        now >= transfer.ticketExpiresAt
      ) {
        throw invalid()
      }
      if (!legacy) {
        if (!cookieMatches(row, cookie, transfer.phone)) {
          throw invalid()
        }
        await requireIdentity(manager, transfer)
        if ((await freshTime(manager)) >= transfer.ticketExpiresAt) {
          throw invalid()
        }
      }
      const secret = legacy ? newOpaque() : null
      Object.assign(transfer, {
        state: legacy ? 'legacy' : 'enrolling',
        ticketHash: null,
        ticketExpiresAt: null,
        challenge: null,
        legacyBindingHash: secret === null ? null : opaqueHash(secret)
      })
      await current(manager, row.id)
      await manager.getRepository(PasskeyMigrationSchema).save(transfer)
      return {
        ...page(row, transfer.phone),
        legacy,
        migration: !legacy,
        handoffOrigin: config.apiOrigin,
        cookie:
          secret === null
            ? ''
            : browserCookie({
                requestId: row.id,
                bindingValue: secret,
                maxAgeSeconds: Math.floor((row.expiresAt.getTime() - now.getTime()) / 1000)
              })
      }
    })
  }

  return {
    actions,
    authorizeLegacy: (ticket: string, host: string | undefined) =>
      authorize(ticket, '', host, true),
    authorizeAccounts: (ticket: string, cookie: string, host: string | undefined) =>
      authorize(ticket, cookie, host, false),
    async browser(
      action: string,
      input: unknown,
      cookie: string,
      origin: string | undefined
    ): Promise<unknown> {
      const legacy =
        action === 'legacy-options' || action === 'legacy-verify' || action === 'legacy-cancel'
      if (legacyOrigin === undefined || origin !== (legacy ? legacyOrigin : config.apiOrigin)) {
        throw invalid()
      }
      const body = requireExactFields(
        input,
        action.endsWith('-verify') ? ['requestId', 'response'] : ['requestId']
      )
      if (typeof body.requestId !== 'string' || !UUID_PATTERN.test(body.requestId)) {
        throw invalid()
      }
      const id = body.requestId
      const result = await loginTransaction(
        deps.dataSource,
        async (manager): Promise<{ value?: unknown; failure?: LoginFailure }> => {
          const row = await current(manager, id)
          const repository = manager.getRepository(PasskeyMigrationSchema)
          if (action.endsWith('legacy-start')) {
            const phone = action === 'phone-legacy-start'
            const binding = phone ? row.phoneBindingHash : row.browserBindingHash
            if (
              binding === null ||
              !cookieMatches(row, cookie, phone) ||
              (!phone && row.confirmationCode !== null)
            ) {
              throw invalid()
            }
            const ticket = newOpaque()
            const now = await freshTime(manager)
            await repository.delete({ requestId: id })
            await repository.insert({
              requestId: id,
              phone,
              sourceBindingHash: binding,
              state: 'departing',
              ticketHash: opaqueHash(ticket),
              ticketExpiresAt: new Date(Math.min(row.expiresAt.getTime(), now.getTime() + 60_000)),
              legacyBindingHash: null,
              challenge: null,
              userId: null,
              credentialId: null
            })
            await manager
              .getRepository(AuthLoginRequestSchema)
              .update({ id }, { webauthnChallenge: null, operation: null, pendingUserId: null })
            return { value: { navigateUrl: `${legacyOrigin}/auth/login/legacy?ticket=${ticket}` } }
          }
          const transfer = await transferFor(manager, row)
          const validCookie = legacy
            ? cookieMatches({ ...row, browserBindingHash: transfer.legacyBindingHash }, cookie)
            : cookieMatches(row, cookie, transfer.phone)
          if (!validCookie || transfer.state !== (legacy ? 'legacy' : 'enrolling')) {
            throw invalid()
          }
          if (action === 'legacy-cancel') {
            await markLoginRequestFailed(manager, row.id)
            await repository.delete({ requestId: id })
            return { value: { canceled: true } }
          }
          if (action === 'legacy-options') {
            const options = await generateAuthenticationOptions({
              rpID: legacyRpId!,
              userVerification: 'required'
            })
            transfer.challenge = options.challenge
            await current(manager, id)
            await repository.save(transfer)
            return { value: options }
          }
          if (action === 'legacy-verify') {
            const response = body.response as AuthenticationResponseJSON | null
            const challenge = transfer.challenge
            transfer.challenge = null
            await repository.save(transfer)
            if (
              challenge === null ||
              response === null ||
              typeof response !== 'object' ||
              typeof response.id !== 'string' ||
              response.id.length > 2048
            ) {
              return { failure: badPasskey() }
            }
            const hint = await manager
              .getRepository(PasskeySchema)
              .findOneBy({ id: response.id, rpId: legacyRpId })
            if (hint === null) {
              return { failure: badPasskey() }
            }
            Object.assign(transfer, { userId: hint.userId, credentialId: hint.id })
            const { user, key } = await requireIdentity(manager, transfer)
            if (response.response?.userHandle !== Buffer.from(user.id).toString('base64url')) {
              return { failure: badPasskey() }
            }
            let verified
            try {
              verified = await verifyAuthenticationResponse({
                response,
                expectedChallenge: challenge,
                expectedOrigin: legacyOrigin,
                expectedRPID: legacyRpId!,
                requireUserVerification: true,
                credential: {
                  id: key.id,
                  publicKey: new Uint8Array(key.publicKey),
                  counter: key.counter,
                  transports: key.transports
                }
              })
              if (
                !verified.verified ||
                verified.authenticationInfo.credentialDeviceType !== key.deviceType
              ) {
                return { failure: badPasskey() }
              }
            } catch {
              return { failure: badPasskey() }
            }
            await current(manager, id)
            const now = await freshTime(manager)
            await manager.getRepository(PasskeySchema).update(
              { id: key.id },
              {
                counter: verified.authenticationInfo.newCounter,
                backedUp: verified.authenticationInfo.credentialBackedUp,
                lastUsedAt: now
              }
            )
            const ticket = newOpaque()
            Object.assign(transfer, {
              state: 'returning',
              legacyBindingHash: null,
              ticketHash: opaqueHash(ticket),
              ticketExpiresAt: new Date(Math.min(row.expiresAt.getTime(), now.getTime() + 60_000))
            })
            await repository.save(transfer)
            return {
              value: { navigateUrl: `${config.apiOrigin}/auth/login/migrate?ticket=${ticket}` }
            }
          }

          const { user, key } = await requireIdentity(manager, transfer)
          await current(manager, id)
          if (action === 'migration-skip') {
            await repository.delete({ requestId: id })
            return { value: await complete(manager, row, user.id, key.id) }
          }
          const keys = await manager.getRepository(PasskeySchema).findBy({ userId: user.id })
          if (keys.length >= 20) {
            throw new LoginFailure(LOGIN_ERRORS.PASSKEY_LIMIT)
          }
          if (action === 'migration-options') {
            const options = await generateRegistrationOptions({
              rpName: config.rpName,
              rpID: config.rpId,
              userID: new Uint8Array(Buffer.from(user.id)),
              userName: `DFRAGON ${user.id.slice(0, 8)}`,
              userDisplayName: 'DFRAGON 계정',
              attestationType: 'none',
              authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
              excludeCredentials: keys
                .filter((entry) => entry.rpId === config.rpId)
                .map((entry) => ({ id: entry.id, transports: entry.transports }))
            })
            transfer.challenge = options.challenge
            await current(manager, id)
            await repository.save(transfer)
            return { value: options }
          }
          if (action !== 'migration-verify' || transfer.challenge === null) {
            throw invalid()
          }
          const challenge = transfer.challenge
          transfer.challenge = null
          await repository.save(transfer)
          let verified
          try {
            verified = await verifyRegistrationResponse({
              response: body.response as RegistrationResponseJSON,
              expectedChallenge: challenge,
              expectedOrigin: config.apiOrigin,
              expectedRPID: config.rpId,
              requireUserVerification: true
            })
            if (!verified.verified) {
              throw badPasskey()
            }
          } catch {
            return { failure: badPasskey() }
          }
          await current(manager, id)
          const info = verified.registrationInfo
          await manager.getRepository(PasskeySchema).insert({
            id: info.credential.id,
            userId: user.id,
            rpId: config.rpId,
            publicKey: Buffer.from(info.credential.publicKey),
            counter: info.credential.counter,
            transports: info.credential.transports ?? [],
            deviceType: info.credentialDeviceType,
            backedUp: info.credentialBackedUp,
            createdAt: await freshTime(manager),
            lastUsedAt: null
          })
          await repository.delete({ requestId: id })
          return { value: await complete(manager, row, user.id, info.credential.id) }
        }
      )
      if (result.failure !== undefined) {
        throw result.failure
      }
      return result.value
    }
  }
}
