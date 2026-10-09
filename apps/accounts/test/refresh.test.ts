import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import test from 'node:test'
import { digest, failure, fixture, load, time } from './refresh.fixtures.js'

const cases = {
  format: 'refresh는 canonical 32-byte token만 DB 조회 전에 허용한다',
  rotation: 'rotation은 이전 활동과 발급 이력을 보존하고 commit 뒤 token을 반환한다',
  reuse: '소비된 refresh 재사용 거절은 session 폐기 commit 뒤 전달한다',
  stale: '없는 row나 잠금 뒤 소유 변경으로 다른 session을 폐기하지 않는다',
  ended: '정확한 idle 만료와 폐기 session은 발급하거나 부활시키지 않는다',
  capped: 'idle 만료 1초 전 JWT는 deadline까지만 유효하고 활동은 연장하지 않는다',
  failures: '서명, 난수, insert, commit 실패는 기존 token을 보존하고 상세를 정제한다',
  entropy: '잘못된 길이의 난수는 서명, 소비, 저장 전에 정제 거절한다',
  retry: 'rotation insert가 rollback된 뒤 기존 refresh를 명시적으로 다시 사용할 수 있다'
} as const

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((complete) => {
    resolve = complete
  })

  return { promise, resolve }
}

test(cases.format, async () => {
  const { rotateRefresh } = await load()
  const bytes = randomBytes(32)
  const canonical = bytes.toString('base64url')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const noncanonical = canonical.slice(0, -1) + alphabet[alphabet.indexOf(canonical.at(-1)!) + 1]
  for (const value of [
    null,
    {},
    1,
    '',
    canonical + '=',
    ' ' + canonical,
    canonical + '\n',
    '+'.repeat(43),
    '/'.repeat(43),
    noncanonical,
    randomBytes(31).toString('base64url'),
    randomBytes(33).toString('base64url'),
    digest(bytes),
    { refreshToken: canonical, sessionId: randomUUID() }
  ]) {
    const f = fixture()
    await failure(rotateRefresh(f.deps, value), 'INVALID_AUTH_REQUEST')
    assert.deepEqual(f.events, [])
  }
})

test(cases.rotation, { timeout: 5000 }, async () => {
  const { rotateRefreshForTest } = await load()
  const f = fixture()
  const bytes = randomBytes(32)
  f.session.createdAt = new Date('2026-08-01T00:00:00.000Z')
  f.session.lastActiveAt = new Date('2026-09-05T00:00:00.000Z')
  const beforeSession = structuredClone(f.session)
  let commitStarted!: () => void
  const committing = new Promise<void>((resolve) => {
    commitStarted = resolve
  })
  let releaseCommit!: () => void
  const release = new Promise<void>((resolve) => {
    releaseCommit = resolve
  })
  f.state.beforeCommit = async () => {
    commitStarted()
    await release
  }
  let returned = false
  const pending = rotateRefreshForTest(f.deps, f.raw, (size) => {
    assert.equal(size, 32)

    return bytes
  }).then((value) => {
    returned = true

    return value
  })
  const observed = pending.then(
    () => 'returned' as const,
    () => 'rejected' as const
  )
  try {
    const first = await Promise.race([committing.then(() => 'committing' as const), observed])
    assert.equal(first, 'committing', 'commit barrier 전에 요청이 완료됨')
    assert.equal(returned, false)
  } finally {
    releaseCommit()
    await observed
  }
  const result = await pending
  assert.deepEqual(result, {
    tokenType: 'Bearer',
    accessToken: 'test-access-placeholder',
    accessTokenExpiresAt: '2026-09-06T00:15:10.000Z',
    refreshToken: bytes.toString('base64url'),
    sessionExpiresAt: '2026-10-05T00:00:00.000Z'
  })
  assert.deepEqual(f.inserted, [
    { tokenHash: digest(bytes), sessionId: f.session.id, issuedAt: time, consumedAt: null }
  ])
  assert.equal(f.token.consumedAt, time)
  assert.deepEqual(f.session, beforeSession)
  assert.deepEqual(f.events, [
    'begin',
    'refresh-hint',
    'session-hint',
    'user-lock',
    'session-lock',
    'refresh-lock',
    'fresh-time',
    'sign',
    'consume',
    'insert',
    'commit'
  ])
})

test(cases.reuse, { timeout: 5000 }, async () => {
  const { rotateRefresh } = await load()
  const f = fixture()
  f.token.consumedAt = time
  const beforeToken = { ...f.token, tokenHash: Buffer.from(f.token.tokenHash) }
  const committing = deferred()
  const release = deferred()
  f.state.beforeCommit = async () => {
    committing.resolve()
    await release.promise
  }
  const operation = rotateRefresh(f.deps, f.raw)
  let completed = false
  const observed = operation.then(
    () => {
      completed = true

      return 'returned' as const
    },
    () => {
      completed = true

      return 'rejected' as const
    }
  )
  try {
    const first = await Promise.race([
      committing.promise.then(() => 'committing' as const),
      observed
    ])
    assert.equal(first, 'committing', 'session 폐기 commit 전에 요청이 완료됨')
    assert.equal(completed, false)
  } finally {
    release.resolve()
    await observed
  }
  await failure(operation, 'AUTHENTICATION_REQUIRED')
  assert.equal(f.session.revokedAt, time)
  assert.equal(f.session.revokedReason, 'refresh_reuse')
  assert.equal(f.session.lastActiveAt, time)
  assert.deepEqual(f.token, beforeToken)
  assert.deepEqual(f.inserted, [])
  assert.deepEqual(f.events.slice(-2), ['revoke', 'commit'])
  assert.equal(f.events.includes('rollback'), false)
  assert.equal(f.events.includes('sign'), false)
})

test(cases.stale, async () => {
  const { rotateRefresh } = await load()
  for (const scenario of [
    'hintMissing',
    'sessionHintMissing',
    'userMissing',
    'sessionMissing',
    'tokenMissing',
    'session-owner',
    'token-owner'
  ]) {
    const f = fixture()
    f.token.consumedAt = time
    const shouldChangeSessionOwner = scenario === 'session-owner'
    const isTokenOwnerScenario = scenario === 'token-owner'
    const shouldChangeTokenOwner = !shouldChangeSessionOwner && isTokenOwnerScenario
    if (shouldChangeSessionOwner) {
      f.state.beforeLockedRead = () => {
        f.session.userId = f.otherUser.id
      }
    } else if (shouldChangeTokenOwner) {
      f.state.beforeLockedRead = () => {
        f.token.sessionId = f.otherSession.id
      }
    } else {
      Object.assign(f.state, { [scenario]: true })
    }
    await failure(rotateRefresh(f.deps, f.raw), 'AUTHENTICATION_REQUIRED')
    assert.equal(f.session.revokedAt, null)
    assert.equal(f.token.consumedAt, time)
    assert.deepEqual(f.inserted, [])
    assert.equal(f.events.includes('consume'), false)
    const hasSignedToken = f.events.includes('sign')
    assert.equal(hasSignedToken, false)
    const hasRevokedSession = f.events.includes('revoke')
    assert.equal(hasRevokedSession, false)
  }
})

test(cases.ended, async () => {
  const { rotateRefresh } = await load()
  for (const offset of [0, 1]) {
    const f = fixture()
    f.state.freshTime = new Date(Date.parse('2026-10-06T00:00:10.000Z') + offset * 1000)
    await failure(rotateRefresh(f.deps, f.raw), 'AUTHENTICATION_REQUIRED')
    assert.equal(f.token.consumedAt, null)
    assert.equal(f.session.lastActiveAt, time)
    const hasSignedToken = f.events.includes('sign')
    assert.equal(hasSignedToken, false)
  }
  const f = fixture()
  f.session.revokedAt = time
  f.session.revokedReason = 'logout'
  f.token.consumedAt = time
  await failure(rotateRefresh(f.deps, f.raw), 'AUTHENTICATION_REQUIRED')
  assert.equal(f.session.revokedReason, 'logout')
})

test(cases.capped, async () => {
  const { rotateRefresh } = await load()
  const f = fixture()
  f.state.freshTime = new Date('2026-10-06T00:00:09.000Z')
  const result = await rotateRefresh(f.deps, f.raw)
  assert.equal(result.accessTokenExpiresAt, '2026-10-06T00:00:10.000Z')
  assert.equal(result.sessionExpiresAt, '2026-10-06T00:00:10.000Z')
  assert.equal(f.session.lastActiveAt, time)
})

test(cases.failures, async () => {
  const { rotateRefreshForTest } = await load()
  for (const scenario of ['sign', 'entropy', 'insert', 'commit']) {
    const f = fixture()
    const explode = () => {
      throw new Error('private detail')
    }
    const shouldFailSigning = scenario === 'sign'
    if (shouldFailSigning) {
      f.deps.issueAccessJwt = explode
    }
    const shouldFailInsert = scenario === 'insert'
    if (shouldFailInsert) {
      f.state.beforeInsert = explode
    }
    const shouldFailCommit = scenario === 'commit'
    if (shouldFailCommit) {
      f.state.beforeCommit = explode
    }
    const shouldFailEntropy = scenario === 'entropy'
    const operation = rotateRefreshForTest(f.deps, f.raw, shouldFailEntropy ? explode : randomBytes)
    const isEntropyFailure = scenario === 'entropy'
    const isSigningScenario = scenario === 'sign'
    const isSigningFailure = !isEntropyFailure && isSigningScenario
    const isInternalFailure = isEntropyFailure || isSigningFailure
    await failure(operation, isInternalFailure ? 'AUTH_INTERNAL_ERROR' : 'AUTH_UNAVAILABLE')
    assert.equal(f.token.consumedAt, null)
    assert.equal(f.session.lastActiveAt, time)
    assert.equal(f.session.revokedAt, null)
    assert.equal(f.session.revokedReason, null)
    assert.deepEqual(f.inserted, [])
    assert.equal(f.events.filter((event) => event === 'begin').length, 1)
    assert.equal(f.events.at(-1), 'rollback')
  }
})

test(cases.entropy, async () => {
  const { rotateRefreshForTest } = await load()
  for (const size of [31, 33]) {
    const f = fixture()
    const beforeToken = { ...f.token, tokenHash: Buffer.from(f.token.tokenHash) }
    const beforeSession = structuredClone(f.session)
    await failure(
      rotateRefreshForTest(f.deps, f.raw, () => Buffer.alloc(size)),
      'AUTH_INTERNAL_ERROR'
    )
    assert.deepEqual(f.token, beforeToken)
    assert.deepEqual(f.session, beforeSession)
    assert.deepEqual(f.inserted, [])
    for (const event of ['sign', 'consume', 'insert', 'commit']) {
      assert.equal(f.events.includes(event), false, event)
    }
    assert.equal(f.events.at(-1), 'rollback')
  }
})

test(cases.retry, async () => {
  const { rotateRefreshForTest } = await load()
  const f = fixture()
  const replacement = randomBytes(32)
  const beforeToken = { ...f.token, tokenHash: Buffer.from(f.token.tokenHash) }
  const beforeSession = structuredClone(f.session)
  f.state.beforeInsert = () => {
    throw new Error('private detail')
  }
  await failure(
    rotateRefreshForTest(f.deps, f.raw, () => replacement),
    'AUTH_UNAVAILABLE'
  )
  assert.deepEqual(f.token, beforeToken)
  assert.deepEqual(f.session, beforeSession)
  assert.deepEqual(f.inserted, [])
  assert.equal(f.events.filter((event) => event === 'begin').length, 1)

  f.state.beforeInsert = () => {}
  const rotated = await rotateRefreshForTest(f.deps, f.raw, () => replacement)
  assert.equal(rotated.refreshToken, replacement.toString('base64url'))
  assert.equal(f.token.consumedAt, time)
  assert.deepEqual(f.inserted, [
    { tokenHash: digest(replacement), sessionId: f.session.id, issuedAt: time, consumedAt: null }
  ])
  assert.deepEqual(f.session, beforeSession)
  assert.equal(f.events.filter((event) => event === 'begin').length, 2)
})
