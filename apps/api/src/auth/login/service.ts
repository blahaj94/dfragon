import { randomInt, randomUUID } from 'node:crypto'
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse
} from '@simplewebauthn/server'
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server'
import type { EntityManager } from 'typeorm'
import { CLEARED_LOGIN_FIELDS, LOGIN, LOGIN_ERRORS } from '../../constants/login.js'
import { INITIAL_NICKNAME } from '../../constants/auth.js'
import { LoginFailure } from '../../errors/login.js'
import { AuthLoginRequestSchema } from '../../database/schemas/auth-login-requests.js'
import type { AuthLoginRequest } from '../../database/schemas/auth-login-requests.js'
import { UserSchema } from '../../database/schemas/users.js'
import { PasskeySchema } from '../../database/schemas/passkeys.js'
import { UUID_PATTERN } from '../access-jwt/constants.js'
import type { LoginDependencies, LoginHttpService } from '../../types/login.js'
import { decodeOpaque, newOpaque, opaqueHash } from './crypto.js'
import {
  configurationFingerprint,
  configuredLoginClient,
  validatePasskeyConfiguration
} from './configuration.js'
import { parseCreation, requireExactFields } from './input.js'
import {
  browserCookie,
  cookieMatches,
  freshTime,
  loginTransaction,
  requestExpired
} from './state.js'
import { phoneLoginAction, clearPhone } from './phone.js'
import { exchangeLogin } from './exchange.js'

const invalid = () => new LoginFailure(LOGIN_ERRORS.REQUEST_INVALID)
const badPasskey = () => new LoginFailure(LOGIN_ERRORS.PASSKEY)
const clearChallenge = { webauthnChallenge: null, operation: null, pendingUserId: null } as const
const userHandle = (id: string) => Buffer.from(id, 'utf8').toString('base64url')

function requestId(input: unknown): string {
  if (typeof input !== 'string' || !UUID_PATTERN.test(input)) {
    throw invalid()
  }
  return input
}

async function lockUser(manager: EntityManager, id: string) {
  const user = await manager
    .getRepository(UserSchema)
    .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } })
  if (user == null) {
    throw invalid()
  }
  return user
}

async function lockCredential(manager: EntityManager, userId: string, id: string) {
  const key = await manager
    .getRepository(PasskeySchema)
    .findOne({ where: { id, userId }, lock: { mode: 'pessimistic_write' } })
  if (key == null) {
    throw badPasskey()
  }
  return key
}

async function checkTime(manager: EntityManager, row: AuthLoginRequest) {
  const now = await freshTime(manager)
  if (requestExpired(row, now)) {
    throw invalid()
  }
  return now
}

/** Browser requests are bound to a single cookie, purpose and configured RP; no client chooses a user. */
export function createLoginService(dependencies: LoginDependencies): LoginHttpService {
  if (!dependencies.dataSource.isInitialized || dependencies.dataSource.options.logging !== false) {
    throw new LoginFailure(LOGIN_ERRORS.INTERNAL)
  }
  const configuration = validatePasskeyConfiguration(dependencies.configuration)
  const deps = Object.freeze({ ...dependencies, configuration })

  async function newRequest(
    purpose: 'login' | 'manage',
    codeChallenge: string | null,
    clientId: 'desktop' | 'ocr' = 'desktop'
  ) {
    return loginTransaction(deps.dataSource, async (manager) => {
      const now = await freshTime(manager)
      const row: AuthLoginRequest = {
        ...CLEARED_LOGIN_FIELDS,
        id: randomUUID(),
        purpose,
        configuration: configurationFingerprint(configuration, clientId),
        createdAt: now,
        expiresAt: new Date(now.getTime() + LOGIN.requestSeconds * 1000),
        status: purpose === 'login' ? 'created' : 'browser_started',
        codeChallenge,
        isNewUser: false,
        consumedAt: null
      }
      const secret = newOpaque()
      if (purpose === 'login') {
        row.launchTicketHash = opaqueHash(secret)
      } else {
        row.browserBindingHash = opaqueHash(secret)
      }
      await manager.getRepository(AuthLoginRequestSchema).insert(row)
      return { row, secret }
    })
  }

  async function options(manager: EntityManager, row: AuthLoginRequest, operation: unknown) {
    const managing = row.status === 'managing'
    if (managing ? operation !== 'add' : operation !== 'register' && operation !== 'authenticate') {
      throw invalid()
    }
    if (operation === 'register' && row.purpose !== 'login') {
      throw invalid()
    }
    if (row.status !== 'browser_started' && !managing) {
      throw invalid()
    }
    if (operation === 'authenticate') {
      const value = await generateAuthenticationOptions({
        rpID: configuration.rpId,
        userVerification: 'required'
      })
      Object.assign(row, clearChallenge, { webauthnChallenge: value.challenge, operation })
      await checkTime(manager, row)
      await manager.getRepository(AuthLoginRequestSchema).save(row)
      return value
    }
    const userId = managing ? row.verifiedUserId! : randomUUID()
    const keys = managing ? await manager.getRepository(PasskeySchema).findBy({ userId }) : []
    if (keys.length >= 20) {
      throw new LoginFailure(LOGIN_ERRORS.PASSKEY_LIMIT)
    }
    const value = await generateRegistrationOptions({
      rpName: configuration.rpName,
      rpID: configuration.rpId,
      userID: new Uint8Array(Buffer.from(userId)),
      userName: `DFRAGON ${userId.slice(0, 8)}`,
      userDisplayName: 'DFRAGON 계정',
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      excludeCredentials: keys.map((key) => ({ id: key.id, transports: key.transports }))
    })
    Object.assign(row, { webauthnChallenge: value.challenge, operation, pendingUserId: userId })
    await checkTime(manager, row)
    await manager.getRepository(AuthLoginRequestSchema).save(row)
    return value
  }

  async function verify(manager: EntityManager, row: AuthLoginRequest, response: unknown) {
    if (
      row.webauthnChallenge == null ||
      row.operation == null ||
      response == null ||
      typeof response !== 'object'
    ) {
      throw invalid()
    }
    const operation = row.operation
    const expectedChallenge = row.webauthnChallenge
    let userId: string
    let credentialId: string
    if (operation === 'authenticate') {
      if (row.status !== 'browser_started') {
        throw invalid()
      }
      // Shape/crypto errors are sanitized and consume only this browser's challenge.
      const credential = response as AuthenticationResponseJSON
      if (typeof credential.id !== 'string' || credential.id.length > 2048) {
        throw badPasskey()
      }
      const hint = await manager.getRepository(PasskeySchema).findOneBy({ id: credential.id })
      if (hint == null) {
        throw badPasskey()
      }
      const user = await lockUser(manager, hint.userId)
      const key = await lockCredential(manager, user.id, credential.id)
      await checkTime(manager, row)
      if (credential.response?.userHandle !== userHandle(user.id)) {
        throw badPasskey()
      }
      let result
      try {
        result = await verifyAuthenticationResponse({
          response: credential,
          expectedChallenge,
          expectedOrigin: configuration.apiOrigin,
          expectedRPID: configuration.rpId,
          requireUserVerification: true,
          credential: {
            id: key.id,
            publicKey: new Uint8Array(key.publicKey),
            counter: key.counter,
            transports: key.transports
          }
        })
      } catch {
        throw badPasskey()
      }
      if (!result.verified || result.authenticationInfo.credentialDeviceType !== key.deviceType) {
        throw badPasskey()
      }
      const now = await checkTime(manager, row)
      await manager.getRepository(PasskeySchema).update(
        { id: key.id },
        {
          counter: result.authenticationInfo.newCounter,
          backedUp: result.authenticationInfo.credentialBackedUp,
          lastUsedAt: now
        }
      )
      userId = user.id
      credentialId = key.id
    } else {
      const adding = operation === 'add'
      if (
        adding
          ? row.status !== 'managing'
          : row.status !== 'browser_started' || row.purpose !== 'login'
      ) {
        throw invalid()
      }
      if (row.pendingUserId == null || (adding && row.pendingUserId !== row.verifiedUserId)) {
        throw invalid()
      }
      userId = row.pendingUserId
      if (adding && (await manager.getRepository(PasskeySchema).countBy({ userId })) >= 20) {
        throw new LoginFailure(LOGIN_ERRORS.PASSKEY_LIMIT)
      }
      let result
      try {
        result = await verifyRegistrationResponse({
          response: response as RegistrationResponseJSON,
          expectedChallenge,
          expectedOrigin: configuration.apiOrigin,
          expectedRPID: configuration.rpId,
          requireUserVerification: true
        })
      } catch {
        throw badPasskey()
      }
      if (!result.verified) {
        throw badPasskey()
      }
      const info = result.registrationInfo
      credentialId = info.credential.id
      const now = await checkTime(manager, row)
      if (!adding) {
        const nickname = `${INITIAL_NICKNAME.prefix}${String(randomInt(0, 10 ** INITIAL_NICKNAME.digits)).padStart(INITIAL_NICKNAME.digits, '0')}`
        await manager.getRepository(UserSchema).insert({ id: userId, nickname, createdAt: now })
      }
      // A global primary key prevents moving an existing credential to another account.
      await manager.getRepository(PasskeySchema).insert({
        id: credentialId,
        userId,
        publicKey: Buffer.from(info.credential.publicKey),
        counter: info.credential.counter,
        transports: info.credential.transports ?? [],
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        createdAt: now,
        lastUsedAt: null
      })
      if (adding) {
        Object.assign(row, clearChallenge)
        await manager.getRepository(AuthLoginRequestSchema).save(row)
        return { managed: true }
      }
    }
    const now = await checkTime(manager, row)
    Object.assign(row, clearChallenge, {
      verifiedUserId: userId,
      credentialId,
      isNewUser: operation === 'register'
    })
    if (row.purpose === 'manage') {
      row.status = 'managing'
      await manager.getRepository(AuthLoginRequestSchema).save(row)
      return { managed: true }
    }
    if (row.phoneBindingHash != null) {
      row.status = 'phone_verified'
      await manager.getRepository(AuthLoginRequestSchema).save(row)
      const user = await manager.getRepository(UserSchema).findOneByOrFail({ id: userId })
      return { phoneVerified: true, nickname: user.nickname }
    }
    return complete(manager, row, now)
  }

  async function complete(manager: EntityManager, row: AuthLoginRequest, now: Date) {
    const code = newOpaque()
    Object.assign(row, {
      ...clearPhone,
      status: 'exchange_ready',
      browserBindingHash: null,
      exchangeCodeHash: opaqueHash(code),
      codeExpiresAt: new Date(
        Math.min(row.expiresAt.getTime(), now.getTime() + LOGIN.codeSeconds * 1000)
      )
    })
    await manager.getRepository(AuthLoginRequestSchema).save(row)
    const clientId = configuredLoginClient(configuration, row.configuration)
    const returnUrl = clientId === 'ocr' ? configuration.ocrReturnUrl : configuration.returnUrl
    if (returnUrl === undefined) {
      throw invalid()
    }
    const url = new URL(returnUrl)
    url.searchParams.set('code', code)
    return { returnUrl: url.href }
  }

  return {
    async create(input) {
      const body = parseCreation(input)
      if (body.clientId === 'ocr' && configuration.ocrReturnUrl === undefined) {
        throw invalid()
      }
      const { row, secret } = await newRequest('login', body.codeChallenge, body.clientId)
      return {
        requestId: row.id,
        browserUrl: `${configuration.apiOrigin}/auth/login/authorize?ticket=${secret}`,
        expiresAt: row.expiresAt.toISOString()
      }
    },
    async manage() {
      const { row, secret } = await newRequest('manage', null)
      return {
        requestId: row.id,
        purpose: 'manage',
        cookie: browserCookie({
          requestId: row.id,
          bindingValue: secret,
          maxAgeSeconds: LOGIN.requestSeconds
        })
      }
    },
    async authorize(ticket, view) {
      const phone = view === 'phone'
      decodeOpaque(ticket)
      return loginTransaction(deps.dataSource, async (manager) => {
        const repo = manager.getRepository(AuthLoginRequestSchema)
        const row = await repo.findOne({
          where: phone
            ? { qrTicketHash: opaqueHash(ticket) }
            : { launchTicketHash: opaqueHash(ticket) },
          lock: { mode: 'pessimistic_write' }
        })
        if (
          row == null ||
          row.status !== (phone ? 'browser_started' : 'created') ||
          configuredLoginClient(configuration, row.configuration) === null
        ) {
          throw invalid()
        }
        const now = await checkTime(manager, row)
        const secret = newOpaque()
        await repo.update(
          { id: row.id },
          phone
            ? { qrTicketHash: null, phoneBindingHash: opaqueHash(secret) }
            : {
                launchTicketHash: null,
                browserBindingHash: opaqueHash(secret),
                status: 'browser_started'
              }
        )
        return {
          requestId: row.id,
          purpose: row.purpose,
          webReturnUrl:
            configuredLoginClient(configuration, row.configuration) === 'ocr'
              ? configuration.ocrReturnUrl
              : undefined,
          ...(phone ? { view: 'phone' as const, confirmationCode: row.confirmationCode! } : {}),
          cookie: browserCookie({
            phone,
            requestId: row.id,
            bindingValue: secret,
            maxAgeSeconds: (row.expiresAt.getTime() - now.getTime()) / 1000
          })
        }
      })
    },
    async browser(action, input, cookie, origin) {
      if (origin !== configuration.apiOrigin) {
        throw invalid()
      }
      const phone = action.startsWith('phone-')
      const fields: Record<string, string[]> = {
        options: ['requestId', 'operation'],
        verify: ['requestId', 'response'],
        list: ['requestId'],
        remove: ['requestId', 'credentialId'],
        end: ['requestId'],
        qr: ['requestId'],
        status: ['requestId'],
        claim: ['requestId'],
        direct: ['requestId'],
        cancel: ['requestId'],
        'phone-options': ['requestId', 'operation'],
        'phone-verify': ['requestId', 'response'],
        'phone-approve': ['requestId'],
        'phone-cancel': ['requestId']
      }
      if (!Object.hasOwn(fields, action)) {
        throw invalid()
      }
      const body = requireExactFields(input, fields[action])
      const id = requestId(body.requestId)
      const result = await loginTransaction(deps.dataSource, async (manager) => {
        const repo = manager.getRepository(AuthLoginRequestSchema)
        const row = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } })
        if (
          row == null ||
          configuredLoginClient(configuration, row.configuration) === null ||
          !cookieMatches(row, cookie, phone)
        ) {
          throw invalid()
        }
        await checkTime(manager, row)
        if (row.status === 'managing') {
          await lockUser(manager, row.verifiedUserId!)
          await lockCredential(manager, row.verifiedUserId!, row.credentialId!)
          await checkTime(manager, row)
        }
        if (
          ['qr', 'status', 'claim', 'direct', 'cancel', 'phone-approve', 'phone-cancel'].includes(
            action
          )
        ) {
          return {
            value: await phoneLoginAction(manager, row, action, configuration.apiOrigin, complete)
          }
        }
        if (phone ? row.phoneBindingHash == null : row.confirmationCode != null) {
          throw invalid()
        }
        if (action === 'options' || action === 'phone-options') {
          return { value: await options(manager, row, body.operation) }
        }
        if (action === 'verify' || action === 'phone-verify') {
          try {
            return { value: await verify(manager, row, body.response) }
          } catch (error) {
            if (!(error instanceof LoginFailure) || error.code !== LOGIN_ERRORS.PASSKEY.code) {
              throw error
            }
            await repo.update({ id }, clearChallenge)
            return { failure: error }
          }
        }
        if (row.status !== 'managing') {
          throw invalid()
        }
        if (action === 'list') {
          const keys = await manager.getRepository(PasskeySchema).find({
            where: { userId: row.verifiedUserId! },
            order: { createdAt: 'ASC', id: 'ASC' }
          })
          return {
            value: {
              keys: keys.map((key) => ({
                id: key.id,
                createdAt: key.createdAt.toISOString(),
                lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
                current: key.id === row.credentialId
              }))
            }
          }
        }
        if (action === 'remove') {
          if (typeof body.credentialId !== 'string' || body.credentialId.length > 2048) {
            throw invalid()
          }
          const keys = manager.getRepository(PasskeySchema)
          await lockCredential(manager, row.verifiedUserId!, body.credentialId)
          if ((await keys.countBy({ userId: row.verifiedUserId! })) <= 1) {
            throw new LoginFailure(LOGIN_ERRORS.LAST_PASSKEY)
          }
          await checkTime(manager, row)
          await keys.delete({ id: body.credentialId, userId: row.verifiedUserId! })
          if (body.credentialId !== row.credentialId) {
            return { value: { managed: true } }
          }
        }
        await repo.update(
          { id },
          { ...CLEARED_LOGIN_FIELDS, status: 'consumed', consumedAt: await freshTime(manager) }
        )
        return { value: { ended: true } }
      })
      if (result.failure) {
        throw result.failure
      }
      return result.value
    },
    exchange: (input) => exchangeLogin(deps, input)
  }
}
