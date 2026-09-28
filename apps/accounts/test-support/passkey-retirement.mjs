import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Client } from 'pg'
import { createDatabaseDataSource } from '../dist/database/index.js'

export async function assertPasskeyRetirement(admin, mark = () => {}) {
  const created = []
  const connections = []
  let roleCreated = false
  const connect = async (database) => {
    const { host, port, username: user, password } = admin.options
    const client = new Client({ host, port, user, password, database })
    await client.connect()
    connections.push(client)
    return client
  }
  const sql = async (name) =>
    (await readFile(new URL(`../../../deploy/accounts/${name}`, import.meta.url), 'utf8')).replace(
      /^\\set.*$/gm,
      ''
    )
  const denied = async (client, statement, message) => {
    try {
      await assert.rejects(client.query(statement), message)
    } finally {
      await client.query('ROLLBACK')
    }
  }
  const rows = async (db) => {
    const result = {}
    for (const table of ['users', 'auth_passkeys', 'auth_sessions', 'auth_refresh_tokens']) {
      result[table] = (
        await db.query(`SELECT to_jsonb(t) AS value FROM ${table} t ORDER BY to_jsonb(t)::text`)
      ).rows
    }
    return result
  }
  try {
    for (const database of ['dfragon_accounts', 'dfragon']) {
      await admin.query(`CREATE DATABASE ${database}`)
      created.push(database)
      const db = createDatabaseDataSource({ ...admin.options, database })
      await db.initialize()
      try {
        if (database === 'dfragon') {
          db.migrations = db.migrations.filter(
            (m) =>
              !m.name.startsWith('AddAccountsPasskeyMigration') &&
              !m.name.startsWith('RetirePasskeyHandoffs')
          )
        }
        await db.runMigrations({ transaction: 'all' })
      } finally {
        await db.destroy()
      }
    }
    const accounts = await connect('dfragon_accounts'),
      source = await connect('dfragon')
    const first = randomUUID(),
      second = randomUUID(),
      session = randomUUID()
    for (const db of [accounts, source]) {
      for (const id of [first, second]) {
        await db.query("INSERT INTO users(id,nickname,created_at) VALUES($1,'보존 계정',NOW())", [
          id
        ])
      }
    }
    for (const [id, user, rp] of [
      ['old-first', first, 'api.dfragon.com'],
      ['new-first', first, 'accounts.dfragon.com'],
      ['old-second', second, 'api.dfragon.com']
    ]) {
      await accounts.query(
        "INSERT INTO auth_passkeys(id,user_id,rp_id,public_key,counter,transports,device_type,backed_up,created_at) VALUES($1,$2,$3,$4,7,'[]','singleDevice',false,NOW())",
        [id, user, rp, randomBytes(32)]
      )
    }
    await accounts.query(
      'INSERT INTO auth_sessions(id,user_id,created_at,last_active_at) VALUES($1,$2,NOW(),NOW())',
      [session, first]
    )
    await accounts.query(
      'INSERT INTO auth_refresh_tokens(token_hash,session_id,issued_at) VALUES($1,$2,NOW())',
      [randomBytes(32), session]
    )
    const oldKeys = await sql('retire-api-passkeys.sql')
    const oldSource = await sql('retire-api-auth.sql')
    mark('unmigrated users prevent all key deletion')
    const beforeDenied = await rows(accounts)
    await denied(accounts, oldKeys, /Every account must retain/)
    assert.deepEqual(await rows(accounts), beforeDenied)
    await denied(source, oldKeys, /Expected the accounts database/)
    await denied(accounts, oldSource, /Expected the frozen API/)
    await accounts.query(
      "INSERT INTO auth_passkeys(id,user_id,rp_id,public_key,counter,transports,device_type,backed_up,created_at) VALUES('new-second',$1,'accounts.dfragon.com',$2,9,'[]','singleDevice',false,NOW())",
      [second, randomBytes(32)]
    )
    const before = await rows(accounts)
    mark('old RP cleanup preserves UUID, current keys, sessions and refresh data')
    await accounts.query(oldKeys)
    const expected = {
      ...before,
      auth_passkeys: before.auth_passkeys.filter(({ value }) => value.rp_id !== 'api.dfragon.com')
    }
    assert.deepEqual(await rows(accounts), expected)
    await accounts.query(oldKeys)
    assert.deepEqual(await rows(accounts), expected)

    mark('retired handoff table removal preserves authentication data')
    const db = createDatabaseDataSource({ ...admin.options, database: 'dfragon_accounts' })
    await db.initialize()
    try {
      const retirement = db.migrations.find((m) => m.name.startsWith('RetirePasskeyHandoffs'))
      await db.transaction(async (manager) => {
        await retirement.down(manager.queryRunner)
        const request = randomUUID()
        await manager.query(
          "INSERT INTO auth_login_requests(id,purpose,configuration,created_at,expires_at,status,is_new_user) VALUES($1,'login',$2,NOW(),NOW()+interval '1 minute','failed',false)",
          [request, 'a'.repeat(64)]
        )
        await manager.query(
          "INSERT INTO auth_passkey_migrations(request_id,phone,source_binding_hash,state,legacy_binding_hash) VALUES($1,false,$2,'legacy',$3)",
          [request, randomBytes(32), randomBytes(32)]
        )
        await retirement.up(manager.queryRunner)
        assert.equal(
          (await manager.query("SELECT to_regclass('public.auth_passkey_migrations') AS value"))[0]
            .value,
          null
        )
        await manager.query('DELETE FROM auth_login_requests WHERE id=$1', [request])
      })
    } finally {
      await db.destroy()
    }
    assert.deepEqual(await rows(accounts), expected)

    mark('source cleanup refuses a live runtime and unexpected domain dependencies')
    await admin.query('CREATE ROLE dfragon_api NOLOGIN')
    roleCreated = true
    const tables = 'users, auth_passkeys, auth_sessions, auth_refresh_tokens, auth_login_requests'
    await source.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${tables} TO dfragon_api`)
    await denied(source, oldSource, /no authentication privileges/)
    await source.query(`REVOKE ALL ON ${tables} FROM dfragon_api, PUBLIC`)
    await source.query(
      'CREATE TABLE domain_fixture(id uuid PRIMARY KEY, owner uuid REFERENCES users(id))'
    )
    await source.query('INSERT INTO domain_fixture(id,owner) VALUES($1,$1)', [first])
    await denied(source, oldSource, /depend/)
    assert.equal((await source.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 2)
    await source.query('ALTER TABLE domain_fixture DROP CONSTRAINT domain_fixture_owner_fkey')
    mark('source users have current accounts keys before removing the frozen source')
    for (const { id } of (await source.query('SELECT id FROM users')).rows) {
      assert.equal(
        (
          await accounts.query(
            "SELECT EXISTS(SELECT FROM auth_passkeys WHERE user_id=$1 AND rp_id='accounts.dfragon.com') AS present",
            [id]
          )
        ).rows[0].present,
        true
      )
    }
    await source.query(oldSource)
    assert.equal((await source.query('SELECT count(*)::int AS n FROM domain_fixture')).rows[0].n, 1)
    assert.equal(
      (await source.query("SELECT to_regclass('public.users') AS value")).rows[0].value,
      null
    )
    assert.deepEqual(await rows(accounts), expected)
  } finally {
    await Promise.all(connections.map((client) => client.end()))
    for (const database of created.reverse()) {
      await admin.query(`DROP DATABASE ${database}`)
    }
    if (roleCreated) {
      await admin.query('DROP ROLE dfragon_api')
    }
  }
}
