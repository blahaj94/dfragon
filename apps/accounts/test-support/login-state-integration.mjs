import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createAccessJwtIssuer } from '../dist/auth/access-jwt/index.js'
import { createIdentitySession } from '../dist/auth/identity-session.js'
import { createLoginService } from '../dist/auth/login/service.js'
import { assertTerminalLoginRequest } from './database-contract.mjs'
import {
  blockedBy,
  bounded,
  databaseNow,
  instrument,
  locked,
  settled,
  waitUntil
} from './login-test-control.mjs'
import { authenticationConfiguration } from './runtime-fixtures.mjs'

const configuration = {
  apiOrigin: 'https://accounts.example.test',
  rpId: 'accounts.example.test',
  rpName: 'DFragon 테스트',
  returnUrl: 'dfragon.dev://auth/callback',
  ocrReturnUrl: 'https://ocr.example.test/auth/callback'
}
const opaque = () => randomBytes(32).toString('base64url')
const hash = (value) => createHash('sha256').update(Buffer.from(value, 'base64url')).digest()
const pkce = (value) => createHash('sha256').update(value).digest('base64url')

function assertLoginFailure(error, code = 'LOGIN_EXCHANGE_INVALID') {
  assert.equal(error?.code, code)
  const status = code === 'AUTH_UNAVAILABLE' ? 503 : 400
  assert.equal(error.status, status)
  const message =
    code === 'AUTH_UNAVAILABLE'
      ? '현재 계정 기능을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      : '로그인 요청이 유효하지 않습니다. 다시 로그인해 주세요.'
  assert.equal(error.message, message)
  assert.equal(error.stack, `LoginFailure: ${message}`)
  assert.equal(error.cause, undefined)
}

async function rejected(operation, code) {
  await assert.rejects(operation, (error) => {
    assertLoginFailure(error, code)

    return true
  })
}

async function snapshot(source, fixture) {
  const request = await source.query('SELECT * FROM auth_login_requests WHERE id=$1', [
    fixture.input.requestId
  ])
  const users = await source.query('SELECT * FROM users WHERE id=$1', [fixture.userId])
  const keys = await source.query('SELECT * FROM auth_passkeys WHERE user_id=$1 ORDER BY id', [
    fixture.userId
  ])
  const sessions = await source.query('SELECT * FROM auth_sessions WHERE user_id=$1 ORDER BY id', [
    fixture.userId
  ])
  const tokens = await source.query(
    'SELECT r.* FROM auth_refresh_tokens r JOIN auth_sessions s ON s.id=r.session_id WHERE s.user_id=$1 ORDER BY r.token_hash',
    [fixture.userId]
  )

  return { request, users, keys, sessions, tokens }
}

async function withExchangeFixture(source, issueAccessJwt, operation) {
  const userId = randomUUID()
  const credentialId = opaque()
  const input = { clientId: 'desktop', code: opaque(), codeVerifier: opaque() }
  const signing = { calls: 0, issue: issueAccessJwt }
  const service = createLoginService({
    dataSource: source,
    configuration,
    issueAccessJwt: async (value) => {
      signing.calls += 1

      return signing.issue(value)
    }
  })
  const request = await service.create({
    provider: 'passkey',
    clientId: input.clientId,
    codeChallenge: pkce(input.codeVerifier),
    codeChallengeMethod: 'S256'
  })
  input.requestId = request.requestId
  try {
    const now = await databaseNow(source)
    await source.transaction('READ COMMITTED', async (manager) => {
      await manager.query('INSERT INTO users(id,nickname,created_at) VALUES($1,$2,$3)', [
        userId,
        '교환 검사',
        new Date(now.getTime() - 60_000)
      ])
      await manager.query(
        `INSERT INTO auth_passkeys(id,user_id,rp_id,public_key,counter,transports,device_type,backed_up,created_at)
         VALUES($1,$2,$3,$4,0,'[]','singleDevice',false,$5)`,
        [credentialId, userId, configuration.rpId, Buffer.alloc(32, 1), now]
      )
      // WebAuthn 뒤의 합법적인 상태를 준비하고 실제 교환 transaction만 검증한다.
      await manager.query(
        `UPDATE auth_login_requests SET status='exchange_ready', launch_ticket_hash=NULL,
         verified_user_id=$2,credential_id=$3,exchange_code_hash=$4,code_expires_at=$5 WHERE id=$1`,
        [input.requestId, userId, credentialId, hash(input.code), new Date(now.getTime() + 60_000)]
      )
      // 기존 기기 session과 이력은 교환 거절, rollback의 영향 밖에 있어야 한다.
      await createIdentitySession(manager, { userId, isNewUser: false })
    })
    await operation({ userId, credentialId, input, service, signing })
  } finally {
    await source.query('DELETE FROM auth_login_requests WHERE id=$1', [input.requestId])
    await source.query('DELETE FROM users WHERE id=$1', [userId])
  }
}

async function bindingsPreserveState(source, issuer) {
  await withExchangeFixture(source, issuer, async (fixture) => {
    await withExchangeFixture(source, issuer, async (other) => {
      const before = await snapshot(source, fixture)
      const otherBefore = await snapshot(source, other)
      for (const input of [
        { ...fixture.input, requestId: other.input.requestId },
        { ...fixture.input, clientId: 'ocr' },
        { ...fixture.input, code: opaque() },
        { ...fixture.input, codeVerifier: opaque() }
      ]) {
        await rejected(() => fixture.service.exchange(input))
        assert.deepEqual(await snapshot(source, fixture), before)
        assert.deepEqual(await snapshot(source, other), otherBefore)
      }
      const changed = createLoginService({
        dataSource: source,
        configuration: { ...configuration, rpName: '교체된 설정' },
        issueAccessJwt: issuer
      })
      await rejected(() => changed.exchange(fixture.input))
      assert.deepEqual(await snapshot(source, fixture), before)
      assert.equal(fixture.signing.calls, 0)
      const result = await fixture.service.exchange(fixture.input)
      assert.deepEqual(result.user, { id: fixture.userId, nickname: '교환 검사' })
      assert.equal(result.isNewUser, false)
      await assertTerminalLoginRequest(source, fixture.input.requestId, 'consumed')
      const after = await snapshot(source, fixture)
      assert.equal(after.sessions.length, before.sessions.length + 1)
      assert.equal(after.tokens.length, before.tokens.length + 1)
      assert.deepEqual(after.users, before.users)
      assert.deepEqual(after.keys, before.keys)
      for (const session of before.sessions) {
        assert.deepEqual(
          after.sessions.find((row) => row.id === session.id),
          session
        )
      }
      for (const token of before.tokens) {
        assert.deepEqual(
          after.tokens.find((row) => row.token_hash.equals(token.token_hash)),
          token
        )
      }
      assert.deepEqual(await snapshot(source, other), otherBefore)
    })
  })
}

async function expiresAfterLock(source, issuer, table) {
  await withExchangeFixture(source, issuer, async (fixture) => {
    const deadline = new Date((await databaseNow(source)).getTime() + 2000)
    await source.query('UPDATE auth_login_requests SET code_expires_at=$2 WHERE id=$1', [
      fixture.input.requestId,
      deadline
    ])
    const before = await snapshot(source, fixture)
    const ids = {
      auth_login_requests: fixture.input.requestId,
      users: fixture.userId,
      auth_passkeys: fixture.credentialId
    }
    const id = ids[table]
    await locked(source, table, id, async ({ runner, pid, unlock }) => {
      const waiter = Promise.withResolvers()
      const restore = instrument(source, {
        query: async ({ sql, parameters, query, run }) => {
          if (sql.includes(table) && sql.includes('FOR UPDATE') && parameters?.includes(id)) {
            waiter.resolve((await query('SELECT pg_backend_pid() AS pid'))[0].pid)
          }

          return run()
        }
      })
      const pending = settled(fixture.service.exchange(fixture.input))
      try {
        await blockedBy(source, await bounded(waiter.promise), pid)
        await waitUntil(source, deadline)
        await unlock()
        assertLoginFailure((await bounded(pending)).error)
      } finally {
        if (runner.isTransactionActive) {
          await unlock()
        }
        await pending
        restore()
      }
    })
    assert.equal(fixture.signing.calls, 0)
    assert.deepEqual(await snapshot(source, fixture), before)
  })
}

async function signingRollback(source, issuer, expiry) {
  await withExchangeFixture(source, issuer, async (fixture) => {
    let deadline
    if (expiry) {
      deadline = new Date((await databaseNow(source)).getTime() + 2000)
      const assignment =
        expiry === 'request' ? 'expires_at=$2,code_expires_at=$2' : 'code_expires_at=$2'
      await source.query(`UPDATE auth_login_requests SET ${assignment} WHERE id=$1`, [
        fixture.input.requestId,
        deadline
      ])
    }
    const before = await snapshot(source, fixture)
    fixture.signing.issue = async (input) => {
      if (!expiry) {
        throw new Error('fixture-private signing SQL detail')
      }
      const jwt = await issuer(input)
      await waitUntil(source, deadline)

      return jwt
    }
    const inserted = []
    const restore = instrument(source, {
      query: async ({ sql, run }) => {
        const result = await run()
        if (sql.startsWith('INSERT INTO "auth_sessions"')) {
          inserted.push('session')
        }

        if (sql.startsWith('INSERT INTO "auth_refresh_tokens"')) {
          inserted.push('refresh')
        }

        return result
      }
    })
    try {
      const errorCode = expiry ? 'LOGIN_EXCHANGE_INVALID' : 'AUTH_UNAVAILABLE'
      await rejected(() => fixture.service.exchange(fixture.input), errorCode)
      assert.equal(fixture.signing.calls, 1)
      assert.deepEqual(inserted, ['session', 'refresh'])
    } finally {
      restore()
    }
    assert.deepEqual(await snapshot(source, fixture), before)
    if (!expiry) {
      fixture.signing.issue = issuer
      await fixture.service.exchange(fixture.input)
      await assertTerminalLoginRequest(source, fixture.input.requestId, 'consumed')
    }
  })
}

async function uncertainCommit(source, issuer, applied) {
  await withExchangeFixture(source, issuer, async (fixture) => {
    const before = await snapshot(source, fixture)
    let commits = 0
    let attempts = 0
    const restore = instrument(source, {
      query: async ({ sql, run }) => {
        if (sql === 'START TRANSACTION') {
          attempts += 1
        }

        return run()
      },
      commit: async (runner, commit) => {
        commits += 1
        if (applied) {
          await commit()
        } else {
          await runner.rollbackTransaction()
        }
        throw new Error('fixture-private commit acknowledgement lost')
      }
    })
    try {
      await rejected(() => fixture.service.exchange(fixture.input), 'AUTH_UNAVAILABLE')
      assert.equal(attempts, 1)
      assert.equal(commits, 1)
      assert.equal(fixture.signing.calls, 1)
    } finally {
      restore()
    }
    if (!applied) {
      assert.deepEqual(await snapshot(source, fixture), before)
      await fixture.service.exchange(fixture.input)
    } else {
      await assertTerminalLoginRequest(source, fixture.input.requestId, 'consumed')
      const committed = await snapshot(source, fixture)
      assert.equal(committed.sessions.length, before.sessions.length + 1)
      assert.equal(committed.tokens.length, before.tokens.length + 1)
      await rejected(() => fixture.service.exchange(fixture.input))
      assert.deepEqual(await snapshot(source, fixture), committed)
    }
    await assertTerminalLoginRequest(source, fixture.input.requestId, 'consumed')
  })
}

async function launchAndBrowserBinding(source, issuer) {
  const service = createLoginService({ dataSource: source, configuration, issueAccessJwt: issuer })
  const request = await service.create({
    provider: 'passkey',
    clientId: 'desktop',
    codeChallenge: pkce(opaque()),
    codeChallengeMethod: 'S256'
  })
  try {
    const ticket = new URL(request.browserUrl).searchParams.get('ticket')
    const results = await Promise.all([
      settled(service.authorize(ticket)),
      settled(service.authorize(ticket))
    ])
    const accepted = results.filter((result) => result.value !== undefined)
    const refused = results.filter((result) => result.error !== undefined)
    assert.equal(accepted.length, 1)
    assert.equal(refused.length, 1)
    assertLoginFailure(refused[0].error, 'LOGIN_REQUEST_INVALID')
    const cookie = accepted[0].value.cookie.split(';')[0]
    const [row] = await source.query('SELECT * FROM auth_login_requests WHERE id=$1', [
      request.requestId
    ])
    assert.equal(row.status, 'browser_started')
    assert.equal(row.launch_ticket_hash, null)
    assert.deepEqual(row.browser_binding_hash, hash(cookie.slice(cookie.indexOf('=') + 1)))
    for (const [header, origin] of [
      ['', configuration.apiOrigin],
      [`${cookie}; ${cookie}`, configuration.apiOrigin],
      [`__Host-dfragon-login-${randomUUID()}=${opaque()}`, configuration.apiOrigin],
      [`__Host-dfragon-login-${request.requestId}=${opaque()}`, configuration.apiOrigin],
      [cookie, 'https://attacker.invalid']
    ]) {
      await rejected(
        () => service.browser('cancel', { requestId: request.requestId }, header, origin),
        'LOGIN_REQUEST_INVALID'
      )
      assert.deepEqual(
        await source.query('SELECT * FROM auth_login_requests WHERE id=$1', [request.requestId]),
        [row]
      )
    }
    await service.browser(
      'cancel',
      { requestId: request.requestId },
      cookie,
      configuration.apiOrigin
    )
    await assertTerminalLoginRequest(source, request.requestId, 'failed')
  } finally {
    await source.query('DELETE FROM auth_login_requests WHERE id=$1', [request.requestId])
  }
}

export async function assertLoginStateIntegration(source, mark) {
  const issuer = await createAccessJwtIssuer(authenticationConfiguration().accessJwt)
  const cases = [
    [
      '앱 proof, client, 설정 불일치는 두 요청과 기존 기기를 보존한다',
      () => bindingsPreserveState(source, issuer)
    ],
    ...['auth_login_requests', 'users', 'auth_passkeys'].map((table) => [
      `${table} 잠금 대기 뒤 code가 만료되면 발급하지 않는다`,
      () => expiresAfterLock(source, issuer, table)
    ]),
    [
      'JWT 발급 실패는 새 session, refresh와 code 소비를 rollback한다',
      () => signingRollback(source, issuer)
    ],
    [
      'JWT 준비 중 code deadline 만료는 session 발급을 rollback한다',
      () => signingRollback(source, issuer, 'code')
    ],
    [
      'JWT 준비 중 전체 요청 TTL 만료는 session 발급을 rollback한다',
      () => signingRollback(source, issuer, 'request')
    ],
    [
      'code 교환 commit 결과가 불명이어도 rollback된 상태를 성공으로 반환하지 않는다',
      () => uncertainCommit(source, issuer, false)
    ],
    [
      'code 교환 commit 응답 유실은 token을 재전달하거나 다시 발급하지 않는다',
      () => uncertainCommit(source, issuer, true)
    ],
    [
      'launch ticket은 한 번만 소비되고 browser cookie, Origin 불일치는 요청을 보존한다',
      () => launchAndBrowserBinding(source, issuer)
    ]
  ]
  for (const [name, run] of cases) {
    mark(name)
    await run()
  }

  return cases.length
}
