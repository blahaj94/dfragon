#!/usr/bin/env bash
set -euo pipefail

# Pass an already-built product image; the test never builds or deploys it.
if [[ $# -ne 1 || "$1" == -* ]]; then
    printf 'Usage: container-deployment.sh IMAGE_REFERENCE\n' >&2
    exit 2
fi
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
exec node --input-type=module - "$1" <<'JS'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'
import {
  verifyApprovedImage, newRunId, createPostgres, teardownPostgres, assertResourcesAbsent, docker
} from './test-support/docker-postgres.mjs'

const runId = newRunId('apiimage')
const runtimeName = `dfragon-image-${runId}`
const maintenanceName = `${runtimeName}-command`
const networkName = `${runtimeName}-network`
const labelKey = 'com.dfragon.image-test.run'
const label = `${labelKey}=${runId}`
let stage = 'image verification'
let resources, admin, directory
let signalCode
process.once('SIGINT', () => { signalCode = 130 })
process.once('SIGTERM', () => { signalCode = 143 })
function checkSignal() {
  if (signalCode !== undefined) throw new Error('Image test interrupted')
}
async function run(args, options) {
  checkSignal()
  const result = await docker(args, options)
  checkSignal()
  return result
}
async function removeOwned(kind, name) {
  const list = kind === 'container' ? ['container', 'ls', '--all'] : ['network', 'ls']
  const filter = kind === 'container' ? `name=^/${name}$` : `name=^${name}$`
  const format = kind === 'container' ? '{{.Names}}' : '{{.Name}}'
  const names = await docker([...list, '--filter', filter, '--format', format])
  if (names.stdout.trim() === '') return
  assert.equal(names.stdout.trim(), name)
  const labelPath = kind === 'container' ? '.Config.Labels' : '.Labels'
  const owner = await docker([kind, 'inspect', name, '--format', `{{ index ${labelPath} "${labelKey}" }}`])
  assert.equal(owner.stdout.trim(), runId)
  await docker(kind === 'container' ? ['rm', '--force', name] : ['network', 'rm', name])
  assert.equal((await docker([...list, '--filter', filter, '--format', format])).stdout.trim(), '')
}

try {
  const [metadata] = JSON.parse((await run(['image', 'inspect', process.argv[2]])).stdout)
  assert.equal(metadata.Config.User, 'node')
  assert.equal(metadata.Os, 'linux')
  const imageId = metadata.Id
  const postgres = await verifyApprovedImage()
  checkSignal()
  process.stdout.write(`Disposable api image recovery: ${runId}\n`)
  resources = await createPostgres(runId, postgres, {
    afterVolumeCreated: checkSignal, afterContainerCreated: checkSignal
  })
  stage = 'authenticated database readiness'
  for (let attempt = 0; attempt < 100; attempt++) {
    checkSignal()
    admin = new pg.Client({
      ...resources.configuration, user: resources.configuration.username,
      connectionTimeoutMillis: 1000, query_timeout: 2000
    })
    try {
      await admin.connect()
      await admin.query('SELECT 1')
      break
    } catch {
      await admin.end().catch(() => {})
      admin = undefined
      await delay(150)
    }
  }
  assert(admin, 'database readiness timed out')
  stage = 'isolated runtime credentials'
  directory = await mkdtemp(join(tmpdir(), 'dfragon-image-'))
  const migratorPassword = randomBytes(32).toString('base64url')
  const runtimePassword = randomBytes(32).toString('base64url')
  await writeFile(join(directory, 'migrator_password'), migratorPassword, { mode: 0o444 })
  await writeFile(join(directory, 'runtime_password'), runtimePassword, { mode: 0o444 })
  await writeFile(join(directory, 'neople_api_key'), randomBytes(32).toString('base64url'), { mode: 0o444 })
  // Only this disposable database receives fixture roles; production grants live in infrastructure.
  assert.equal(resources.configuration.database, 'dfragon_auth_test')
  await admin.query(`
    CREATE ROLE dfragon_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${migratorPassword}';
    CREATE ROLE dfragon_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${runtimePassword}';
    REVOKE ALL ON DATABASE dfragon_auth_test FROM PUBLIC;
    GRANT CONNECT ON DATABASE dfragon_auth_test TO dfragon_migrator, dfragon_api;
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    ALTER SCHEMA public OWNER TO dfragon_migrator;
    GRANT USAGE ON SCHEMA public TO dfragon_api;
  `)
  assert.equal((await run(['network', 'ls', '--filter', `name=^${networkName}$`, '--format', '{{.Name}}'])).stdout.trim(), '')
  await run(['network', 'create', '--label', label, networkName])
  await run(['network', 'connect', '--alias', 'database', networkName, resources.containerName])
  const runtimeOptions = [
    '--label', label, '--network', networkName, '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--tmpfs', '/tmp:size=16m,mode=1777', '--init',
    '--env', 'DB_HOST=database', '--env', 'DB_PORT=5432',
    '--env', `DB_NAME=${resources.configuration.database}`
  ]
  const migrate = ['run', '--rm', '--name', maintenanceName, ...runtimeOptions,
    '--env', 'DB_USERNAME=dfragon_migrator',
    '--mount', `type=bind,source=${join(directory, 'migrator_password')},target=/run/secrets/db_password,readonly`,
    imageId, 'node', '--import', 'reflect-metadata', 'dist/database/cli.js', 'up']
  stage = 'public migration and repeat'
  await run(migrate)
  const migrations = (await admin.query('SELECT * FROM typeorm_migrations ORDER BY id')).rows
  assert(migrations.length > 0)
  const grantSql = (await readFile('./test-support/grant-api.sql', 'utf8'))
    .split('\n').filter((line) => !line.startsWith('\\')).join('\n')
  await admin.query(grantSql)
  await admin.query('RESET ROLE')
  await run(migrate)
  assert.deepEqual((await admin.query('SELECT * FROM typeorm_migrations ORDER BY id')).rows, migrations)
  stage = 'compiled product startup'
  await run(['run', '--detach', '--name', runtimeName, ...runtimeOptions,
    '--publish', '127.0.0.1::3000', '--env', 'PORT=3000', '--env', 'DB_USERNAME=dfragon_api',
    '--env', 'SEARCH_TRUST_PROXY=single-hop',
    '--mount', `type=bind,source=${join(directory, 'runtime_password')},target=/run/secrets/db_password,readonly`,
    '--mount', `type=bind,source=${join(directory, 'neople_api_key')},target=/run/secrets/neople_api_key,readonly`,
    imageId])
  const [runtime] = JSON.parse((await run(['container', 'inspect', runtimeName])).stdout)
  assert.equal(runtime.Config.User, 'node')
  assert(runtime.HostConfig.ReadonlyRootfs)
  assert(runtime.HostConfig.CapDrop.includes('ALL'))
  assert(runtime.HostConfig.SecurityOpt.some((value) => value.startsWith('no-new-privileges')))
  assert.equal(runtime.HostConfig.PortBindings['3000/tcp'][0].HostIp, '127.0.0.1')
  const secretMounts = runtime.Mounts.filter((mount) => mount.Type === 'bind')
  assert.deepEqual(secretMounts.map((mount) => mount.Destination).sort(), ['/run/secrets/db_password', '/run/secrets/neople_api_key'])
  assert(secretMounts.every((mount) => mount.RW === false))
  stage = 'UID, read-only filesystem, secrets, database privileges and HTTP'
  await run(['exec', runtimeName, 'node', '--input-type=module', '--eval', `
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import pg from 'pg'
assert.equal(process.getuid(), 1000)
assert.equal(process.getgid(), 1000)
assert.throws(() => writeFileSync('/app/write-probe', ''), { code: 'EROFS' })
for (const path of ['/app/src', '/app/test-support', '/run/secrets/postgres_password', '/run/secrets/dfragon_migrator_password']) {
  assert.equal(existsSync(path), false)
}
const db = new pg.Client({ host: 'database', database: process.env.DB_NAME, user: 'dfragon_api', password: readFileSync('/run/secrets/db_password', 'utf8') })
try {
  await db.connect()
  for (const table of ['characters', 'character_api_responses']) {
    await db.query(\`SELECT count(*) FROM \${table}\`)
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      assert.equal((await db.query('SELECT has_table_privilege(current_user, $1, $2) AS allowed', [table, privilege])).rows[0].allowed, true, \`\${table}: \${privilege}\`)
    }
  }
  await assert.rejects(db.query('CREATE TABLE denied_probe (id integer)'), { code: '42501' })
  await assert.rejects(db.query('SELECT * FROM typeorm_migrations'), { code: '42501' })
  await assert.rejects(db.query('SET ROLE dfragon_migrator'), { code: '42501' })
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
assert.equal((await fetch('http://127.0.0.1:3000/health', { signal: AbortSignal.timeout(1000) })).status, 200)
assert.equal((await fetch('http://127.0.0.1:3000/me', { signal: AbortSignal.timeout(1000) })).status, 404)
assert.equal(existsSync('/run/secrets/auth_config'), false)

  `])

  stage = 'graceful stop'
  await run(['stop', '--time', '15', runtimeName])
  assert.equal((await run(['inspect', '--format', '{{.State.ExitCode}}', runtimeName])).stdout.trim(), '0')
} catch {
  process.stderr.write(`api image verification failed at ${stage}\n`)
  process.exitCode = signalCode ?? 1
} finally {
  const cleanup = [
    () => removeOwned('container', runtimeName),
    () => removeOwned('container', maintenanceName),
    async () => { if (admin) await admin.end() },
    async () => { if (resources) await teardownPostgres(resources) },
    () => assertResourcesAbsent(runId),
    () => removeOwned('network', networkName),
    async () => { if (directory) await rm(directory, { recursive: true, force: true }) }
  ]
  for (const operation of cleanup) {
    try { await operation() } catch {
      process.stderr.write('api image test resource cleanup failed\n')
      process.exitCode = 1
    }
  }
  if (signalCode !== undefined && process.exitCode === undefined) process.exitCode = signalCode
}
if (process.exitCode === undefined) {
  process.stdout.write('PASS: api image migration/repeat, runtime contract and graceful stop\n')
}
JS
