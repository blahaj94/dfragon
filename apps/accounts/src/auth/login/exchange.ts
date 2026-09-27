import { AuthLoginRequestSchema } from '../../database/schemas/auth-login-requests.js'
import { UserSchema } from '../../database/schemas/users.js'
import { PasskeySchema } from '../../database/schemas/passkeys.js'
import { CLEARED_LOGIN_FIELDS, LOGIN, LOGIN_ERRORS } from '../../constants/login.js'
import { LoginFailure } from '../../errors/login.js'
import type { LoginDependencies, LoginTokens } from '../../types/login.js'
import { createIdentitySession } from '../identity-session.js'
import { challenge, equalHash, opaqueHash } from './crypto.js'
import { configuredLoginClient } from './configuration.js'
import { parseExchange } from './input.js'
import { exchangeExpired, freshTime, loginTransaction } from './state.js'

export async function exchangeLogin(deps: LoginDependencies, input: unknown): Promise<LoginTokens> {
  const body = parseExchange(input)
  return loginTransaction(deps.dataSource, async (manager) => {
    const repo = manager.getRepository(AuthLoginRequestSchema)
    const row = await repo.findOne({
      where: { id: body.requestId },
      lock: { mode: 'pessimistic_write' }
    })
    const invalid = () => new LoginFailure(LOGIN_ERRORS.EXCHANGE_INVALID)
    if (
      row == null ||
      row.purpose !== 'login' ||
      row.status !== 'exchange_ready' ||
      body.clientId !== configuredLoginClient(deps.configuration, row.configuration)
    ) {
      throw invalid()
    }
    if (
      row.codeChallenge !== challenge(body.codeVerifier) ||
      !equalHash(row.exchangeCodeHash, opaqueHash(body.code))
    ) {
      throw invalid()
    }
    if (exchangeExpired(row, await freshTime(manager))) {
      throw invalid()
    }
    const user = await manager
      .getRepository(UserSchema)
      .findOne({ where: { id: row.verifiedUserId! }, lock: { mode: 'pessimistic_write' } })
    if (user == null) {
      throw invalid()
    }
    const key = await manager.getRepository(PasskeySchema).findOne({
      where: { id: row.credentialId!, userId: user.id },
      lock: { mode: 'pessimistic_write' }
    })
    if (key == null || exchangeExpired(row, await freshTime(manager))) {
      throw invalid()
    }
    const session = await createIdentitySession(manager, {
      userId: user.id,
      isNewUser: row.isNewUser
    })
    const issuedAt = session.session.createdAt.getTime() / 1000
    const idleDeadline = issuedAt + LOGIN.idleSeconds
    const jwt = await deps.issueAccessJwt({
      userId: user.id,
      sessionId: session.session.id,
      issuedAt,
      idleDeadline
    })
    const now = await freshTime(manager)
    if (exchangeExpired(row, now)) {
      throw invalid()
    }
    await repo.update(
      { id: row.id },
      { ...CLEARED_LOGIN_FIELDS, status: 'consumed', consumedAt: now }
    )
    return {
      tokenType: 'Bearer',
      accessToken: jwt.accessToken,
      accessTokenExpiresAt: new Date(jwt.expiresAt * 1000).toISOString(),
      refreshToken: session.refreshToken,
      sessionExpiresAt: new Date(idleDeadline * 1000).toISOString(),
      user: session.user,
      isNewUser: row.isNewUser
    }
  })
}
