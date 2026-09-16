import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { EntityManager } from 'typeorm'
import { AuthRefreshTokenSchema } from '../database/schemas/auth-refresh-tokens.js'
import { AuthSessionSchema } from '../database/schemas/auth-sessions.js'
import { UserSchema } from '../database/schemas/users.js'
import { AUTH_ERRORS, REFRESH_TOKEN } from '../constants/auth.js'
import { IdentitySessionFailure } from '../errors/identity-session.js'
import type { IdentitySession, IdentitySessionEntropy, VerifiedIdentity } from '../types/auth.js'

export { IdentitySessionFailure } from '../errors/identity-session.js'
export type { IdentitySession, VerifiedIdentity } from '../types/auth.js'

const nativeEntropy: IdentitySessionEntropy = {
  uuid: randomUUID,
  refreshBytes: randomBytes
}

const databaseTimeExpression = 'to_timestamp(floor(extract(epoch from clock_timestamp())))'

function generate<T>(operation: () => T): T {
  try {
    return operation()
  } catch {
    throw new IdentitySessionFailure(AUTH_ERRORS.INTERNAL)
  }
}

async function create({
  manager,
  identity,
  entropy
}: {
  manager: EntityManager
  identity: VerifiedIdentity
  entropy: IdentitySessionEntropy
}): Promise<IdentitySession> {
  try {
    const isTransactionActive = manager.queryRunner?.isTransactionActive === true
    if (!isTransactionActive) {
      throw new IdentitySessionFailure(AUTH_ERRORS.INTERNAL)
    }
    const user = await manager
      .getRepository(UserSchema)
      .findOne({ where: { id: identity.userId }, lock: { mode: 'pessimistic_write' } })
    if (user == null) {
      throw new IdentitySessionFailure(AUTH_ERRORS.INTERNAL)
    }
    const isNewUser = identity.isNewUser

    const [clock] = (await manager.query(`SELECT ${databaseTimeExpression} AS now`)) as Array<{
      now: Date
    }>
    const issuedAt = clock.now
    const sessionId = generate(() => entropy.uuid())
    const bytes = generate(() => entropy.refreshBytes(REFRESH_TOKEN.byteLength))
    const refreshToken = bytes.toString(REFRESH_TOKEN.encoding)
    const tokenHash = createHash(REFRESH_TOKEN.hashAlgorithm).update(bytes).digest()
    await manager.getRepository(AuthSessionSchema).insert({
      id: sessionId,
      userId: user.id,
      createdAt: issuedAt,
      lastActiveAt: issuedAt,
      revokedAt: null,
      revokedReason: null
    })
    await manager.getRepository(AuthRefreshTokenSchema).insert({
      tokenHash,
      sessionId,
      issuedAt,
      consumedAt: null
    })
    return {
      user: { id: user.id, nickname: user.nickname },
      session: { id: sessionId, createdAt: issuedAt, lastActiveAt: issuedAt },
      refreshToken,
      isNewUser
    }
  } catch (error) {
    // QueryFailedError의 SQL/parameters·identity를 호출자나 log에 전달하지 않는다.
    const isIdentitySessionFailure = error instanceof IdentitySessionFailure
    if (isIdentitySessionFailure) {
      throw error
    }
    throw new IdentitySessionFailure(AUTH_ERRORS.UNAVAILABLE)
  }
}

/**
 * 호출자의 active READ COMMITTED transaction에 합성한다. 로그인 요청 row 잠금은 호출자가 먼저 한다.
 * 오류는 transaction 밖으로 전파해 전체 rollback하며, commit 성공 후에만 반환 token을 전달한다.
 * Random 충돌도 전체 rollback 대상이다. 재시작 시 새 transaction과 새 entropy를 사용한다.
 */
export function createIdentitySession(
  manager: EntityManager,
  identity: VerifiedIdentity
): Promise<IdentitySession> {
  return create({ manager, identity, entropy: nativeEntropy })
}

/** 기존 adapter와 같은 test 전용 entropy 주입 경계. Runtime 설정으로 노출하지 않는다. */
export function createIdentitySessionForTest(
  manager: EntityManager,
  identity: VerifiedIdentity,
  entropy: Partial<IdentitySessionEntropy>
): Promise<IdentitySession> {
  return create({ manager, identity, entropy: { ...nativeEntropy, ...entropy } })
}
