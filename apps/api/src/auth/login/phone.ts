import { randomInt } from 'node:crypto'
import type { EntityManager } from 'typeorm'
import {
  AuthLoginRequestSchema,
  type AuthLoginRequest
} from '../../database/schemas/auth-login-requests.js'
import { UserSchema } from '../../database/schemas/users.js'
import { PasskeySchema } from '../../database/schemas/passkeys.js'
import { CLEARED_LOGIN_FIELDS, LOGIN_ERRORS } from '../../constants/login.js'
import { LoginFailure } from '../../errors/login.js'
import { newOpaque, opaqueHash } from './crypto.js'
import { freshTime, requestExpired } from './state.js'

export const clearPhone = {
  qrTicketHash: null,
  phoneBindingHash: null,
  confirmationCode: null
} as const

/** Called with the request locked and the PC or phone cookie already checked. */
export async function phoneLoginAction(
  manager: EntityManager,
  row: AuthLoginRequest,
  action: string,
  origin: string,
  complete: (
    manager: EntityManager,
    row: AuthLoginRequest,
    now: Date
  ) => Promise<{ returnUrl: string }>
) {
  const invalid = () => new LoginFailure(LOGIN_ERRORS.REQUEST_INVALID)
  const repo = manager.getRepository(AuthLoginRequestSchema)
  if (
    row.purpose !== 'login' ||
    !['browser_started', 'phone_verified', 'phone_approved'].includes(row.status)
  ) {
    throw invalid()
  }
  if (action === 'cancel' || action === 'phone-cancel') {
    await repo.update({ id: row.id }, { ...CLEARED_LOGIN_FIELDS, status: 'failed' })
    return { ended: true }
  }
  if (action === 'qr' || action === 'direct') {
    Object.assign(row, clearPhone, {
      status: 'browser_started',
      webauthnChallenge: null,
      operation: null,
      pendingUserId: null,
      verifiedUserId: null,
      credentialId: null,
      isNewUser: false
    })
    if (action === 'direct') {
      await repo.save(row)
      return { ready: true }
    }
    const ticket = newOpaque()
    Object.assign(row, {
      qrTicketHash: opaqueHash(ticket),
      confirmationCode: String(randomInt(0, 1_000_000)).padStart(6, '0')
    })
    await repo.save(row)
    return {
      phoneUrl: `${origin}/auth/login/phone?ticket=${ticket}`,
      confirmationCode: row.confirmationCode,
      expiresAt: row.expiresAt.toISOString()
    }
  }
  if (row.confirmationCode == null) {
    throw invalid()
  }
  if (action === 'status') {
    if (row.status !== 'phone_approved') {
      return { approved: false }
    }
    const user = await manager.getRepository(UserSchema).findOneBy({ id: row.verifiedUserId! })
    if (user == null) {
      throw invalid()
    }
    return { approved: true, nickname: user.nickname }
  }
  if (
    action === 'phone-approve' ? row.status !== 'phone_verified' : row.status !== 'phone_approved'
  ) {
    throw invalid()
  }
  const user = await manager.getRepository(UserSchema).findOne({
    where: { id: row.verifiedUserId! },
    lock: { mode: 'pessimistic_write' }
  })
  const key = await manager.getRepository(PasskeySchema).findOne({
    where: { id: row.credentialId!, userId: row.verifiedUserId! },
    lock: { mode: 'pessimistic_write' }
  })
  const now = await freshTime(manager)
  if (user == null || key == null || requestExpired(row, now)) {
    throw invalid()
  }
  if (action === 'phone-approve') {
    row.status = 'phone_approved'
    await repo.save(row)
    return { approved: true }
  }
  return complete(manager, row, now)
}
