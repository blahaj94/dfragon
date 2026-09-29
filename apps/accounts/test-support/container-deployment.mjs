import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'
import {
  verifyApprovedImage,
  newRunId,
  createPostgres,
  teardownPostgres,
  assertResourcesAbsent,
  docker
} from './docker-postgres.mjs'
import { authenticationConfiguration } from './runtime-fixtures.mjs'

// The image must already be present locally; this check never builds or deploys it.
const imageArguments = process.argv.slice(2)
const [imageReference] = imageArguments
if (imageArguments.length !== 1 || imageReference.trim() === '' || imageReference.startsWith('-')) {
  process.stderr.write('Usage: node container-deployment.mjs IMAGE_REFERENCE\n')
  process.exit(2)
}
const runtimeCheckPath = fileURLToPath(new URL('./container-runtime-check.mjs', import.meta.url))

const runId = newRunId('accountsimage')
const runtimeName = `dfragon-image-${runId}`
const maintenanceName = `${runtimeName}-command`
const networkName = `${runtimeName}-network`
const labelKey = 'com.dfragon.image-test.run'
const label = `${labelKey}=${runId}`
let stage = 'image verification'
let resources, admin, directory
let signalCode
process.once('SIGINT', () => {
  signalCode = 130
})
process.once('SIGTERM', () => {
  signalCode = 143
})
function checkSignal() {
  if (signalCode !== undefined) {
    throw new Error('Image test interrupted')
  }
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
  if (names.stdout.trim() === '') {
    return
  }
  assert.equal(names.stdout.trim(), name)
  const labelPath = kind === 'container' ? '.Config.Labels' : '.Labels'
  const owner = await docker([
    kind,
    'inspect',
    name,
    '--format',
    `{{ index ${labelPath} "${labelKey}" }}`
  ])
  assert.equal(owner.stdout.trim(), runId)
  await docker(kind === 'container' ? ['rm', '--force', name] : ['network', 'rm', name])
  assert.equal((await docker([...list, '--filter', filter, '--format', format])).stdout.trim(), '')
}

try {
  const [metadata] = JSON.parse((await run(['image', 'inspect', imageReference])).stdout)
  assert.equal(metadata.Config.User, 'node')
  assert.equal(metadata.Os, 'linux')
  const imageId = metadata.Id
  const postgres = await verifyApprovedImage()
  checkSignal()
  process.stdout.write(`Disposable accounts image recovery: ${runId}\n`)
  resources = await createPostgres(runId, postgres, {
    afterVolumeCreated: checkSignal,
    afterContainerCreated: checkSignal
  })
  stage = 'authenticated database readiness'
  for (let attempt = 0; attempt < 100; attempt++) {
    checkSignal()
    admin = new pg.Client({
      ...resources.configuration,
      user: resources.configuration.username,
      connectionTimeoutMillis: 1000,
      query_timeout: 2000
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
  await writeFile(join(directory, 'auth_config'), JSON.stringify(authenticationConfiguration()), {
    mode: 0o444
  })
  // Only this disposable database receives fixture roles; production grants live in infrastructure.
  assert.equal(resources.configuration.database, 'dfragon_auth_test')
  await admin.query(`
    CREATE ROLE dfragon_accounts_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${migratorPassword}';
    CREATE ROLE dfragon_accounts LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${runtimePassword}';
    REVOKE ALL ON DATABASE dfragon_auth_test FROM PUBLIC;
    GRANT CONNECT ON DATABASE dfragon_auth_test TO dfragon_accounts_migrator, dfragon_accounts;
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    ALTER SCHEMA public OWNER TO dfragon_accounts_migrator;
    GRANT USAGE ON SCHEMA public TO dfragon_accounts;
  `)
  assert.equal(
    (
      await run(['network', 'ls', '--filter', `name=^${networkName}$`, '--format', '{{.Name}}'])
    ).stdout.trim(),
    ''
  )
  await run(['network', 'create', '--label', label, networkName])
  await run(['network', 'connect', '--alias', 'database', networkName, resources.containerName])
  const runtimeOptions = [
    '--label',
    label,
    '--network',
    networkName,
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--tmpfs',
    '/tmp:size=16m,mode=1777',
    '--init',
    '--env',
    'DB_HOST=database',
    '--env',
    'DB_PORT=5432',
    '--env',
    `DB_NAME=${resources.configuration.database}`
  ]
  const migrate = [
    'run',
    '--rm',
    '--name',
    maintenanceName,
    ...runtimeOptions,
    '--env',
    'DB_USERNAME=dfragon_accounts_migrator',
    '--mount',
    `type=bind,source=${join(directory, 'migrator_password')},target=/run/secrets/db_password,readonly`,
    imageId,
    'node',
    '--import',
    'reflect-metadata',
    'dist/database/cli.js',
    'up'
  ]
  stage = 'public migration and repeat'
  await run(migrate)
  const migrations = (await admin.query('SELECT * FROM typeorm_migrations ORDER BY id')).rows
  assert(migrations.length > 0)
  await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.users, public.auth_passkeys, public.auth_sessions, public.auth_refresh_tokens,
       public.auth_login_requests TO dfragon_accounts`)
  await run(migrate)
  assert.deepEqual(
    (await admin.query('SELECT * FROM typeorm_migrations ORDER BY id')).rows,
    migrations
  )
  stage = 'compiled product startup'
  await run([
    'run',
    '--detach',
    '--name',
    runtimeName,
    ...runtimeOptions,
    '--publish',
    '127.0.0.1::3000',
    '--env',
    'PORT=3000',
    '--env',
    'DB_USERNAME=dfragon_accounts',
    '--env',
    'AUTH_TRUST_PROXY=single-hop',
    '--env',
    'AUTH_CONFIG_FILE=/run/secrets/auth_config',
    '--mount',
    `type=bind,source=${join(directory, 'runtime_password')},target=/run/secrets/db_password,readonly`,
    '--mount',
    `type=bind,source=${join(directory, 'auth_config')},target=/run/secrets/auth_config,readonly`,
    '--mount',
    `type=bind,source=${runtimeCheckPath},target=/app/container-runtime-check.mjs,readonly`,
    imageId
  ])
  const [runtime] = JSON.parse((await run(['container', 'inspect', runtimeName])).stdout)
  assert.equal(runtime.Config.User, 'node')
  assert(runtime.HostConfig.ReadonlyRootfs)
  assert(runtime.HostConfig.CapDrop.includes('ALL'))
  assert(runtime.HostConfig.SecurityOpt.some((value) => value.startsWith('no-new-privileges')))
  assert.equal(runtime.HostConfig.PortBindings['3000/tcp'][0].HostIp, '127.0.0.1')
  const runtimeMounts = runtime.Mounts.filter((mount) => mount.Type === 'bind')
  assert.deepEqual(runtimeMounts.map((mount) => mount.Destination).sort(), [
    '/app/container-runtime-check.mjs',
    '/run/secrets/auth_config',
    '/run/secrets/db_password'
  ])
  assert(runtimeMounts.every((mount) => mount.RW === false))
  stage = 'UID, read-only filesystem, secrets, database privileges and HTTP'
  await run(['exec', runtimeName, 'node', '/app/container-runtime-check.mjs'])
  stage = 'public cleanup command'
  await run([
    'run',
    '--rm',
    '--name',
    maintenanceName,
    ...runtimeOptions,
    '--env',
    'DB_USERNAME=dfragon_accounts',
    '--mount',
    `type=bind,source=${join(directory, 'runtime_password')},target=/run/secrets/db_password,readonly`,
    imageId,
    'node',
    '--import',
    'reflect-metadata',
    'dist/auth/cleanup/cli.js'
  ])

  stage = 'graceful stop'
  await run(['stop', '--time', '15', runtimeName])
  assert.equal(
    (await run(['inspect', '--format', '{{.State.ExitCode}}', runtimeName])).stdout.trim(),
    '0'
  )
} catch {
  process.stderr.write(`accounts image verification failed at ${stage}\n`)
  process.exitCode = signalCode ?? 1
} finally {
  const cleanup = [
    () => removeOwned('container', runtimeName),
    () => removeOwned('container', maintenanceName),
    async () => {
      if (admin) {
        await admin.end()
      }
    },
    async () => {
      if (resources) {
        await teardownPostgres(resources)
      }
    },
    () => assertResourcesAbsent(runId),
    () => removeOwned('network', networkName),
    async () => {
      if (directory) {
        await rm(directory, { recursive: true, force: true })
      }
    }
  ]
  for (const operation of cleanup) {
    try {
      await operation()
    } catch {
      process.stderr.write('accounts image test resource cleanup failed\n')
      process.exitCode = 1
    }
  }
  if (signalCode !== undefined && process.exitCode === undefined) {
    process.exitCode = signalCode
  }
}
if (process.exitCode === undefined) {
  process.stdout.write(
    'PASS: accounts image migration/repeat, runtime contract and graceful stop\n'
  )
}
