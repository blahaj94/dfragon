import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createDatabaseDataSource } from '../dist/database/index.js'
import {
  assertSchema,
  assertTerminalLoginRequest,
  insertLogin,
  loginRequest
} from './database-contract.mjs'

async function accountRows(source) {
  const result = {}
  for (const table of ['users', 'auth_passkeys', 'auth_sessions', 'auth_refresh_tokens']) {
    result[table] = await source.query(`SELECT * FROM "${table}" ORDER BY 1`)
  }

  return result
}

export async function assertPhoneQrRetirement(admin, mark = () => {}) {
  const source = createDatabaseDataSource({
    ...admin.options,
    database: 'dfragon_phone_qr_retirement_test'
  })
  let created = false
  try {
    await admin.query('CREATE DATABASE dfragon_phone_qr_retirement_test')
    created = true
    await source.initialize()
    const migrations = source.migrations.toSorted(
      (left, right) => Number(left.name.slice(-13)) - Number(right.name.slice(-13))
    )
    const removal = migrations.find((migration) => migration.name.startsWith('RemovePhoneQrLogin'))
    assert.ok(removal)
    const removalIndex = migrations.indexOf(removal)
    source.migrations = migrations.slice(0, removalIndex)
    await source.runMigrations({ transaction: 'all' })
    const user = randomUUID()
    const session = randomUUID()
    await source.query("INSERT INTO users(id,nickname,created_at) VALUES($1,'보존 계정',NOW())", [
      user
    ])
    await source.query(
      "INSERT INTO auth_passkeys(id,user_id,rp_id,public_key,counter,transports,device_type,backed_up,created_at) VALUES('preserved-key',$1,'accounts.dfragon.com',$2,7,'[]','singleDevice',false,NOW())",
      [user, randomBytes(32)]
    )
    await source.query(
      'INSERT INTO auth_sessions(id,user_id,created_at,last_active_at) VALUES($1,$2,NOW(),NOW())',
      [session, user]
    )
    for (const consumed of [false, true]) {
      await source.query(
        'INSERT INTO auth_refresh_tokens(token_hash,session_id,issued_at,consumed_at) VALUES($1,$2,NOW(),CASE WHEN $3 THEN NOW() ELSE NULL END)',
        [randomBytes(32), session, consumed]
      )
    }
    const now = new Date(Math.floor(Date.now() / 1000) * 1000)
    const expiresAt = new Date(now.getTime() + 600_000)
    const request = (status, overrides = {}) =>
      loginRequest(status, randomUUID(), {
        created_at: now,
        expires_at: expiresAt,
        ...overrides
      })
    const direct = [
      request('created'),
      request('browser_started'),
      request('browser_started', {
        webauthn_challenge: 'direct-registration-challenge',
        operation: 'register',
        pending_user_id: randomUUID()
      }),
      request('browser_started', {
        webauthn_challenge: 'direct-authentication-challenge',
        operation: 'authenticate'
      }),
      request('exchange_ready', {
        verified_user_id: user,
        credential_id: 'preserved-key',
        code_expires_at: new Date(now.getTime() + 60_000)
      }),
      request('browser_started', { purpose: 'manage', code_challenge: null }),
      request('browser_started', {
        purpose: 'manage',
        code_challenge: null,
        webauthn_challenge: 'manage-authentication-challenge',
        operation: 'authenticate'
      }),
      request('managing', {
        purpose: 'manage',
        browser_binding_hash: randomBytes(32),
        verified_user_id: user,
        credential_id: 'preserved-key'
      }),
      request('consumed', { consumed_at: now }),
      request('failed')
    ]
    const qr = [
      request('browser_started', { qr_ticket_hash: randomBytes(32) }),
      request('browser_started', {
        phone_binding_hash: randomBytes(32),
        webauthn_challenge: 'phone-registration-challenge',
        operation: 'register',
        pending_user_id: randomUUID()
      }),
      ...['phone_verified', 'phone_approved'].map((status) =>
        request(status, {
          code_challenge: 'a'.repeat(43),
          browser_binding_hash: randomBytes(32),
          phone_binding_hash: randomBytes(32),
          verified_user_id: user,
          credential_id: 'preserved-key',
          is_new_user: true
        })
      )
    ].map((row) => ({ ...row, confirmation_code: '123456' }))
    for (const row of [...direct, ...qr]) {
      await insertLogin(source, row)
    }
    const before = await accountRows(source)
    mark('활성 QR 요청 종료와 직접 로그인, 관리, 회원, 키, session, refresh 보존')
    source.migrations = migrations.slice(0, removalIndex + 1)
    assert.deepEqual(
      (await source.runMigrations({ transaction: 'all' })).map((migration) => migration.name),
      [removal.name]
    )
    assert.deepEqual(await accountRows(source), before)
    for (const row of direct) {
      assert.deepEqual(
        await source.query('SELECT * FROM auth_login_requests WHERE id=$1', [row.id]),
        [row]
      )
    }
    for (const row of qr) {
      const [ended] = await source.query('SELECT * FROM auth_login_requests WHERE id=$1', [row.id])
      // 뒤의 loopback migration도 요청을 종료하므로 QR 제거 직후에 검증한다.
      assert.equal(ended.status, 'failed')
      for (const field of [
        'code_challenge',
        'launch_ticket_hash',
        'browser_binding_hash',
        'webauthn_challenge',
        'operation',
        'pending_user_id',
        'verified_user_id',
        'credential_id',
        'exchange_code_hash',
        'code_expires_at',
        'consumed_at'
      ]) {
        assert.equal(ended[field], null, `QR 제거 직후 ${field}를 지워야 한다`)
      }
      assert.equal(ended.is_new_user, row.is_new_user)
      assert.deepEqual(ended.created_at, row.created_at)
      assert.deepEqual(ended.expires_at, row.expires_at)
    }
    assert.equal(
      (await source.query('SELECT count(*)::int AS n FROM auth_login_requests'))[0].n,
      direct.length + qr.length
    )
    source.migrations = migrations
    await source.runMigrations({ transaction: 'all' })
    for (const row of qr) {
      await assertTerminalLoginRequest(source, row.id, 'failed')
    }
    await assertSchema(source)
    assert.deepEqual((await source.driver.createSchemaBuilder().log()).upQueries, [])
    assert.deepEqual(await source.runMigrations({ transaction: 'all' }), [])

    mark('빈 disposable DB의 구조 rollback과 재적용')
    await source.query('DELETE FROM auth_login_requests')
    await source.query('DELETE FROM users')
    await source.undoLastMigration({ transaction: 'all' })
    await source.undoLastMigration({ transaction: 'all' })
    const columns = await source.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='auth_login_requests' AND column_name IN ('qr_ticket_hash','phone_binding_hash','confirmation_code') ORDER BY column_name"
    )
    assert.deepEqual(
      columns.map((column) => column.column_name),
      ['confirmation_code', 'phone_binding_hash', 'qr_ticket_hash']
    )
    assert.deepEqual(await source.query('SELECT * FROM auth_login_requests'), [])
    await source.runMigrations({ transaction: 'all' })
    await assertSchema(source)
  } finally {
    if (source.isInitialized) {
      await source.destroy()
    }

    if (created) {
      await admin.query('DROP DATABASE dfragon_phone_qr_retirement_test')
    }
  }
}
