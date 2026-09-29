import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import pg from 'pg'
assert.equal(process.getuid(), 1000)
assert.equal(process.getgid(), 1000)
assert.throws(() => writeFileSync('/app/write-probe', ''), { code: 'EROFS' })
for (const path of [
  '/app/src',
  '/app/test-support',
  '/run/secrets/postgres_password',
  '/run/secrets/dfragon_accounts_migrator_password'
]) {
  assert.equal(existsSync(path), false)
}
const db = new pg.Client({
  host: 'database',
  database: process.env.DB_NAME,
  user: 'dfragon_accounts',
  password: readFileSync('/run/secrets/db_password', 'utf8')
})
try {
  await db.connect()
  for (const table of [
    'users',
    'auth_passkeys',
    'auth_sessions',
    'auth_refresh_tokens',
    'auth_login_requests'
  ]) {
    await db.query(`SELECT count(*) FROM ${table}`)
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      assert.equal(
        (
          await db.query('SELECT has_table_privilege(current_user, $1, $2) AS allowed', [
            table,
            privilege
          ])
        ).rows[0].allowed,
        true,
        `${table}: ${privilege}`
      )
    }
  }
  await assert.rejects(db.query('CREATE TABLE denied_probe (id integer)'), { code: '42501' })
  await assert.rejects(db.query('SELECT * FROM typeorm_migrations'), { code: '42501' })
  await assert.rejects(db.query('SET ROLE dfragon_accounts_migrator'), { code: '42501' })
} finally {
  await db.end()
}
let response
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    response = await fetch('http://127.0.0.1:3000/', { signal: AbortSignal.timeout(1000) })
    break
  } catch {
    await setTimeout(200)
  }
}
assert.equal(response?.status, 404)
assert.equal(
  (await fetch('http://127.0.0.1:3000/me', { signal: AbortSignal.timeout(1000) })).status,
  401
)
assert.equal(
  (await fetch('http://127.0.0.1:3000/characters', { signal: AbortSignal.timeout(1000) })).status,
  404
)
assert.equal(existsSync('/run/secrets/neople_api_key'), false)
assert.equal(existsSync('/run/secrets/import_source'), false)
