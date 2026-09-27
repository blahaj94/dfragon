import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import { createDatabaseDataSource } from '../dist/database/index.js'
import { importAccounts } from '../dist/database/import/accounts.js'

export async function assertAccountsImport(admin, mark = () => {}) {
  const suffix = randomUUID().replaceAll('-', '')
  const sourceName = 'dfragon',
    targetName = `accounts_import_target_${suffix}`
  const connections = []
  const client = async (database) => {
    const { host, port, username: user, password } = admin.options
    const connection = new Client({ host, port, user, password, database })
    connections.push(connection)
    await connection.connect()
    return connection
  }
  const created = []
  try {
    for (const database of [sourceName, targetName]) {
      await admin.query(`CREATE DATABASE ${database}`)
      created.push(database)
      const db = createDatabaseDataSource({ ...admin.options, database })
      try {
        await db.initialize()
        if (database === sourceName) {
          db.migrations = db.migrations.filter(
            (m) => !m.name.startsWith('AddAccountsPasskeyMigration')
          )
        }
        await db.runMigrations({ transaction: 'all' })
      } finally {
        if (db.isInitialized) {
          await db.destroy()
        }
      }
    }
    const source = await client(sourceName),
      target = await client(targetName)
    const id = randomUUID(),
      session = randomUUID(),
      keyId = randomBytes(24).toString('base64url')
    await source.query(
      "INSERT INTO users (id,nickname,created_at) VALUES ($1,'보존 계정','2026-09-01T00:00:00Z')",
      [id]
    )
    // Cross the import batch boundary while preserving every UUID.
    for (let i = 0; i < 501; i++) {
      await source.query(
        "INSERT INTO users (id,nickname,created_at) VALUES ($1,'배치 계정','2026-09-01T00:00:00Z')",
        [randomUUID()]
      )
    }
    await source.query(
      "INSERT INTO auth_passkeys (id,user_id,public_key,counter,transports,device_type,backed_up,created_at,last_used_at) VALUES ($1,$2,$3,42,'[\"internal\",\"hybrid\"]','multiDevice',true,'2026-09-01T00:00:00Z','2026-09-02T00:00:00Z')",
      [keyId, id, randomBytes(64)]
    )
    await source.query(
      "INSERT INTO auth_sessions (id,user_id,created_at,last_active_at) VALUES ($1,$2,'2026-09-01T00:00:00Z','2026-09-02T00:00:00Z')",
      [session, id]
    )
    for (const consumed of [true, true, false]) {
      await source.query(
        "INSERT INTO auth_refresh_tokens (token_hash,session_id,issued_at,consumed_at) VALUES ($1,$2,'2026-09-01T00:00:00Z',$3)",
        [randomBytes(32), session, consumed ? new Date('2026-09-02T00:00:00Z') : null]
      )
    }
    const rows = async (db, table, order) =>
      (await db.query(`SELECT * FROM ${table} ORDER BY ${order}`)).rows
    const original = Object.fromEntries(
      await Promise.all(
        [
          ['users', 'id'],
          ['auth_passkeys', 'id'],
          ['auth_sessions', 'id'],
          ['auth_refresh_tokens', 'token_hash']
        ].map(async ([name, order]) => [name, await rows(source, name, order)])
      )
    )
    mark('source freeze removes the old runtime authentication privileges')
    await source.query('CREATE ROLE dfragon_api NOLOGIN')
    await source.query(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON users, auth_passkeys, auth_sessions, auth_refresh_tokens, auth_login_requests TO dfragon_api'
    )
    const freeze = await readFile(
      new URL('../../../deploy/accounts/freeze-source.sql', import.meta.url),
      'utf8'
    )
    await source.query(freeze.replace(/^\\set.*$/gm, ''))
    for (const table of Object.keys(original)) {
      assert.equal(
        (
          await source.query(
            "SELECT has_table_privilege('dfragon_api', $1, 'SELECT,INSERT,UPDATE,DELETE') AS allowed",
            [table]
          )
        ).rows[0].allowed,
        false
      )
    }
    mark('failed copy rolls back all previously copied authentication rows')
    await target.query(
      'ALTER TABLE auth_sessions ADD CONSTRAINT synthetic_import_failure CHECK (false)'
    )
    await assert.rejects(importAccounts(source, target, 'api.dfragon.com'))
    for (const name of Object.keys(original)) {
      assert.equal((await target.query(`SELECT count(*)::int AS n FROM ${name}`)).rows[0].n, 0)
    }
    await target.query('ALTER TABLE auth_sessions DROP CONSTRAINT synthetic_import_failure')
    mark(
      'separate database import preserves UUID, key material, counters and all consumed refresh history'
    )
    assert.deepEqual(await importAccounts(source, target, 'api.dfragon.com'), {
      users: 502,
      auth_passkeys: 1,
      auth_sessions: 1,
      auth_refresh_tokens: 3
    })
    for (const [name, order] of [
      ['users', 'id'],
      ['auth_passkeys', 'id'],
      ['auth_sessions', 'id'],
      ['auth_refresh_tokens', 'token_hash']
    ]) {
      const targetRows = await rows(target, name, order)
      const expected =
        name === 'auth_passkeys'
          ? original[name].map((row) => ({ ...row, rp_id: 'api.dfragon.com' }))
          : original[name]
      assert.deepEqual(targetRows, expected)
      assert.deepEqual(await rows(source, name, order), original[name])
    }
    assert.equal(
      (await target.query('SELECT count(*)::int AS n FROM auth_login_requests')).rows[0].n,
      0
    )
    mark('populated destination is never overwritten or merged')
    await assert.rejects(importAccounts(source, target, 'api.dfragon.com'), /must be empty/)
    assert.deepEqual(await rows(target, 'users', 'id'), original.users)
  } finally {
    await Promise.all(connections.map((c) => c.end()))
    await admin.query('DROP ROLE IF EXISTS dfragon_api')
    for (const database of created.reverse()) {
      await admin.query(`DROP DATABASE ${database}`)
    }
  }
}
