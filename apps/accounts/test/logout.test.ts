import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes, randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { logoutSession } from '../src/auth/logout/index.js'
import { checkedAt, logoutFixture } from './logout.fixtures.js'

const cases = {
  format: 'logout은 canonical refresh 형식 오류를 DB 조회 전에 거절한다',
  committed: '현재·소비된 refresh의 session 폐기는 commit 뒤 성공하고 활동·token은 보존한다',
  stale: '없는 row·잠금 뒤 소유 변경·종료 session의 logout은 데이터를 변경하지 않는다',
  deadline: 'logout은 잠금 뒤 fresh 시각의 정확한 idle 만료 경계를 다시 확인한다',
  failure: 'logout의 DB·commit 실패는 성공으로 응답하거나 자동 재시도하지 않는다'
} as const

async function expectUnavailable(operation: Promise<void>): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert(error instanceof Error)
    assert('code' in error)
    assert('status' in error)
    assert.equal(error.code, 'AUTH_UNAVAILABLE')
    assert.equal(error.status, 503)
    assert.equal(error.message, '현재 계정 기능을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.')
    assert.equal(error.cause, undefined)
    assert.doesNotMatch(String(error.stack), /private|credential|SQL/)

    return true
  })
}

async function expectInvalidRequest(operation: Promise<void>): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert(error instanceof Error)
    assert('code' in error)
    assert('status' in error)
    assert.equal(error.code, 'INVALID_AUTH_REQUEST')
    assert.equal(error.status, 400)
    assert.equal(error.message, '인증 요청을 확인해 주세요.')
    assert.equal(error.cause, undefined)

    return true
  })
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((complete) => {
    resolve = complete
  })

  return { promise, resolve }
}

test(cases.format, async () => {
  const canonical = randomBytes(32).toString('base64url')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const finalCharacter = canonical.at(-1)!
  const noncanonical = canonical.slice(0, -1) + alphabet[alphabet.indexOf(finalCharacter) + 1]
  for (const rawToken of [
    null,
    {},
    1,
    '',
    ' ',
    `${canonical}=`,
    ` ${canonical}`,
    `${canonical}\n`,
    noncanonical,
    randomBytes(31).toString('base64url'),
    randomBytes(33).toString('base64url'),
    '+'.repeat(43),
    '/'.repeat(43),
    { refreshToken: canonical, sessionId: randomUUID() }
  ]) {
    const f = logoutFixture()
    const beforeSession = structuredClone(f.session)
    const beforeToken = { ...f.token, tokenHash: Buffer.from(f.token.tokenHash) }
    await expectInvalidRequest(logoutSession(f.dataSource, rawToken))
    assert.deepEqual(f.events, [])
    assert.deepEqual(f.session, beforeSession)
    assert.deepEqual(f.token, beforeToken)
  }
})

test(cases.committed, { timeout: 5000 }, async () => {
  for (const isConsumed of [false, true]) {
    const f = logoutFixture()
    f.token.consumedAt = isConsumed ? checkedAt : null
    const beforeToken = { ...f.token, tokenHash: Buffer.from(f.token.tokenHash) }
    const beforeActivity = f.session.lastActiveAt
    const commitStarted = deferred()
    const releaseCommit = deferred()
    f.state.beforeCommit = async () => {
      commitStarted.resolve()
      await releaseCommit.promise
    }

    let resolved = false
    const pending = logoutSession(f.dataSource, f.rawToken).then(() => {
      resolved = true
    })
    const observed = pending.then(
      () => 'returned' as const,
      () => 'rejected' as const
    )
    try {
      const first = await Promise.race([
        commitStarted.promise.then(() => 'committing' as const),
        observed
      ])
      assert.equal(first, 'committing', 'logout commit 전에 요청이 완료됨')
      assert.equal(resolved, false)
    } finally {
      releaseCommit.resolve()
      await observed
    }
    await pending

    assert.equal(f.session.revokedAt, checkedAt)
    assert.equal(f.session.revokedReason, 'logout')
    assert.equal(f.session.lastActiveAt, beforeActivity)
    assert.deepEqual(f.token, beforeToken)
    assert.deepEqual(f.events, [
      'begin',
      'refresh-hint',
      'session-hint',
      'user-lock',
      'session-lock',
      'refresh-lock',
      'fresh-time',
      'revoke',
      'commit'
    ])
  }
})

test(cases.stale, async () => {
  const scenarios = [
    ['refresh hint 없음', 'tokenHintMissing'],
    ['session hint 없음', 'sessionHintMissing'],
    ['user 삭제', 'userMissing'],
    ['session 삭제', 'sessionMissing'],
    ['refresh 삭제', 'tokenMissing'],
    ['잠금 대기 중 session 소유 변경', 'sessionOwnerChanged'],
    ['잠금 대기 중 refresh 소유 변경', 'tokenOwnerChanged'],
    ['잠금 대기 중 제출 hash 삭제', 'tokenHashChanged'],
    ['이미 refresh_reuse로 폐기', 'alreadyRevoked'],
    ['idle 만료', 'idleExpired']
  ] as const

  for (const [name, scenario] of scenarios) {
    const f = logoutFixture()
    f.token.consumedAt = checkedAt
    if (scenario === 'alreadyRevoked') {
      f.session.revokedAt = checkedAt
      f.session.revokedReason = 'refresh_reuse'
    } else if (scenario === 'idleExpired') {
      f.session.lastActiveAt = new Date('2026-08-01T00:00:00.000Z')
    } else if (
      scenario === 'sessionOwnerChanged' ||
      scenario === 'tokenOwnerChanged' ||
      scenario === 'tokenHashChanged'
    ) {
      f.state.beforeLockedRead = (kind) => {
        if (kind !== 'user') {
          return
        }

        if (scenario === 'sessionOwnerChanged') {
          f.session.userId = f.otherUser.id
        } else if (scenario === 'tokenOwnerChanged') {
          f.token.sessionId = f.otherSession.id
        } else {
          f.token.tokenHash = randomBytes(32)
        }
      }
    } else {
      f.state[scenario] = true
    }

    const beforeActivity = f.session.lastActiveAt
    const beforeConsumed = f.token.consumedAt
    const beforeRevoked = f.session.revokedAt
    const beforeReason = f.session.revokedReason
    await logoutSession(f.dataSource, f.rawToken)
    assert.equal(f.session.revokedAt, beforeRevoked, name)
    assert.equal(f.session.revokedReason, beforeReason, name)
    assert.equal(f.session.lastActiveAt, beforeActivity, name)
    assert.equal(f.token.consumedAt, beforeConsumed, name)
    assert.equal(f.events.includes('revoke'), false, name)
    assert.equal(f.events.at(-1), 'commit', name)
  }
})

test(cases.deadline, async () => {
  for (const [name, lastActiveAt, shouldRevoke] of [
    ['만료 1초 전', '2026-08-07T00:00:01.000Z', true],
    ['정확한 만료', '2026-08-07T00:00:00.000Z', false],
    ['만료 1초 후', '2026-08-06T23:59:59.000Z', false]
  ] as const) {
    const f = logoutFixture()
    f.session.lastActiveAt = new Date(lastActiveAt)
    f.state.freshTime = new Date('2026-09-05T23:59:59.000Z')
    // 요청 시작 때의 시각을 재사용하면 정확한 만료를 앞둔 session까지 폐기한다.
    f.state.beforeLockedRead = (kind) => {
      if (kind === 'refresh') {
        f.state.freshTime = checkedAt
      }
    }
    const beforeToken = { ...f.token, tokenHash: Buffer.from(f.token.tokenHash) }
    await logoutSession(f.dataSource, f.rawToken)
    assert.equal(f.events.includes('revoke'), shouldRevoke, name)
    assert.equal(f.session.revokedAt, shouldRevoke ? checkedAt : null, name)
    assert.equal(f.session.revokedReason, shouldRevoke ? 'logout' : null, name)
    assert.equal(f.session.lastActiveAt.toISOString(), lastActiveAt, name)
    assert.deepEqual(f.token, beforeToken, name)
    assert.equal(f.events.at(-1), 'commit', name)
  }
})

test(cases.failure, async () => {
  for (const failurePoint of ['transaction', 'commit'] as const) {
    const f = logoutFixture()
    const beforeSession = structuredClone(f.session)
    const beforeToken = { ...f.token, tokenHash: Buffer.from(f.token.tokenHash) }
    const rawError = new Error('private credential SQL detail')
    if (failurePoint === 'transaction') {
      f.state.transactionFailure = rawError
    } else {
      f.state.commitFailure = rawError
    }

    await expectUnavailable(logoutSession(f.dataSource, f.rawToken))
    assert.equal(f.events.filter((event) => event === 'begin').length, 1)
    assert.equal(f.events.includes('commit'), false)
    assert.deepEqual(f.session, beforeSession)
    assert.deepEqual(f.token, beforeToken)
  }
})
