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

export async function assertLoginReturnUrlMigration(admin, mark = () => {}) {
  const source = createDatabaseDataSource({
    ...admin.options,
    database: 'dfragon_login_return_url_test'
  })
  let created = false
  try {
    await admin.query('CREATE DATABASE dfragon_login_return_url_test')
    created = true
    await source.initialize()
    const migrations = source.migrations.toSorted(
      (left, right) => Number(left.name.slice(-13)) - Number(right.name.slice(-13))
    )
    const addition = migrations.find((migration) => migration.name.startsWith('AddLoginReturnUrl'))
    assert.ok(addition)
    source.migrations = migrations.slice(0, migrations.indexOf(addition))
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
    const active = [
      loginRequest('created', randomUUID()),
      loginRequest('browser_started', randomUUID(), {
        webauthn_challenge: 'registration-challenge',
        operation: 'register',
        pending_user_id: randomUUID()
      }),
      loginRequest('exchange_ready', randomUUID()),
      loginRequest('browser_started', randomUUID(), { purpose: 'manage', code_challenge: null }),
      loginRequest('managing', randomUUID(), {
        purpose: 'manage',
        browser_binding_hash: randomBytes(32),
        verified_user_id: user,
        credential_id: 'preserved-key'
      })
    ]
    const terminal = [loginRequest('failed', randomUUID()), loginRequest('consumed', randomUUID())]
    for (const row of [...active, ...terminal]) {
      await insertLogin(source, row)
    }
    const before = await accountRows(source)
    mark('기존 진행 요청 종료, terminal과 회원, 패스키, session, refresh 보존')
    source.migrations = migrations
    assert.deepEqual(
      (await source.runMigrations({ transaction: 'all' })).map((migration) => migration.name),
      [addition.name]
    )
    assert.deepEqual(await accountRows(source), before)
    for (const row of active) {
      await assertTerminalLoginRequest(source, row.id, 'failed')
      const [ended] = await source.query('SELECT * FROM auth_login_requests WHERE id=$1', [row.id])
      assert.deepEqual(ended.created_at, row.created_at)
      assert.deepEqual(ended.expires_at, row.expires_at)
      assert.equal(ended.configuration, row.configuration)
    }
    for (const row of terminal) {
      assert.deepEqual(
        await source.query('SELECT * FROM auth_login_requests WHERE id=$1', [row.id]),
        [{ ...row, return_url: null }]
      )
    }
    await assertSchema(source)
    assert.deepEqual((await source.driver.createSchemaBuilder().log()).upQueries, [])
    assert.deepEqual(await source.runMigrations({ transaction: 'all' }), [])

    mark('빈 disposable DB에서 loopback column rollback과 재적용')
    await source.query('DELETE FROM auth_login_requests')
    await source.query('DELETE FROM users')
    await source.undoLastMigration({ transaction: 'all' })
    assert.deepEqual(
      await source.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name='auth_login_requests' AND column_name='return_url'"
      ),
      []
    )
    await source.runMigrations({ transaction: 'all' })
    await assertSchema(source)
    assert.deepEqual((await source.driver.createSchemaBuilder().log()).upQueries, [])
  } finally {
    if (source.isInitialized) {
      await source.destroy()
    }

    if (created) {
      await admin.query('DROP DATABASE dfragon_login_return_url_test')
    }
  }
}
