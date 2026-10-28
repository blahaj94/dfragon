import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const imageArguments = process.argv.slice(2)
const [imageReference] = imageArguments
if (imageArguments.length !== 1 || imageReference.trim() === '' || imageReference.startsWith('-')) {
  process.stderr.write('Usage: node container-deployment.mjs IMAGE_REFERENCE\n')
  process.exit(2)
}
const runtimeCheckPath = fileURLToPath(new URL('./container-runtime-check.mjs', import.meta.url))

const runId = `apiimage${randomUUID().replaceAll('-', '')}`
const runtimeName = `dfragon-image-${runId}`
const maintenanceName = `${runtimeName}-command`
const labelKey = 'com.dfragon.image-test.run'
const label = `${labelKey}=${runId}`
// Docker CLI가 쓰는 변수만 넘기고 상위 프로세스의 credential은 넘기지 않는다.
const dockerEnvironment = Object.fromEntries(
  ['PATH', 'HOME', 'DOCKER_CONFIG', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY']
    .filter((name) => process.env[name] !== undefined)
    .map((name) => [name, process.env[name]])
)
let stage = 'image verification'
let directory
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
function docker(args, { allowFailure = false } = {}) {
  checkSignal()

  return new Promise((resolve, reject) => {
    execFile(
      'docker',
      args,
      { env: dockerEnvironment, timeout: 60_000, killSignal: 'SIGKILL' },
      (error, stdout, stderr) => {
        const code = error == null ? 0 : (error.code ?? 1)
        const signal = error?.signal ?? null
        const failed = code !== 0 || signal !== null
        if (failed && (!allowFailure || typeof code !== 'number' || signal !== null)) {
          reject(new Error(`Docker command failed: ${args[0]}`))

          return
        }
        resolve({ code, signal, stdout, stderr })
      }
    )
  })
}
async function removeOwned(name) {
  const filter = `name=^/${name}$`
  const names = await docker([
    'container',
    'ls',
    '--all',
    '--filter',
    filter,
    '--format',
    '{{.Names}}'
  ])
  if (names.stdout.trim() === '') {
    return
  }
  assert.equal(names.stdout.trim(), name)
  const owner = await docker([
    'container',
    'inspect',
    name,
    '--format',
    `{{ index .Config.Labels "${labelKey}" }}`
  ])
  assert.equal(owner.stdout.trim(), runId)
  await docker(['rm', '--force', name])
}

try {
  const [metadata] = JSON.parse((await docker(['image', 'inspect', imageReference])).stdout)
  assert.equal(metadata.Config.User, 'node')
  assert.equal(metadata.Os, 'linux')
  const imageId = metadata.Id
  process.stdout.write(`Disposable api image recovery: ${runId}\n`)
  stage = 'isolated runtime credentials'
  directory = await mkdtemp(join(tmpdir(), 'dfragon-image-'))
  const neopleKey = randomBytes(32).toString('base64url')
  await writeFile(join(directory, 'neople_api_key'), neopleKey, { mode: 0o444 })
  const runtimeOptions = [
    '--platform',
    `${metadata.Os}/${metadata.Architecture}${metadata.Variant ? `/${metadata.Variant}` : ''}`,
    '--label',
    label,
    '--network',
    'none',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--tmpfs',
    '/tmp:size=16m,mode=1777',
    '--init'
  ]
  for (const mode of ['legacy', 'file', 'environment']) {
    const expectedMounts = ['/app/container-runtime-check.mjs']
    const serviceInput = []
    if (mode === 'environment') {
      serviceInput.push('--env', `NEOPLE_API_KEY=${neopleKey}`)
    } else {
      const target =
        mode === 'legacy' ? '/run/secrets/neople_api_key' : '/run/fixture/neople_api_key'
      expectedMounts.push(target)
      serviceInput.push(
        '--mount',
        `type=bind,source=${join(directory, 'neople_api_key')},target=${target},readonly`
      )
      if (mode === 'file') {
        serviceInput.push('--env', `NEOPLE_API_KEY_FILE=${target}`)
      }
    }
    stage = 'compiled product startup'
    await docker([
      'run',
      '--detach',
      '--name',
      runtimeName,
      ...runtimeOptions,
      '--env',
      'PORT=3000',
      '--env',
      'SEARCH_TRUST_PROXY=single-hop',
      ...serviceInput,
      '--mount',
      `type=bind,source=${runtimeCheckPath},target=/app/container-runtime-check.mjs,readonly`,
      imageId
    ])
    const [runtime] = JSON.parse((await docker(['container', 'inspect', runtimeName])).stdout)
    assert.equal(runtime.Config.User, 'node')
    assert(runtime.HostConfig.ReadonlyRootfs)
    assert(runtime.HostConfig.CapDrop.includes('ALL'))
    assert(runtime.HostConfig.SecurityOpt.some((value) => value.startsWith('no-new-privileges')))
    const runtimeMounts = runtime.Mounts.filter((mount) => mount.Type === 'bind')
    assert.deepEqual(runtimeMounts.map((mount) => mount.Destination).sort(), expectedMounts.sort())
    assert(runtimeMounts.every((mount) => mount.RW === false))
    stage = 'UID, read-only filesystem, secrets and HTTP'
    await docker(['exec', runtimeName, 'node', '/app/container-runtime-check.mjs'])

    stage = 'graceful stop'
    await docker(['stop', '--time', '15', runtimeName])
    assert.equal(
      (await docker(['inspect', '--format', '{{.State.ExitCode}}', runtimeName])).stdout.trim(),
      '0'
    )
    await removeOwned(runtimeName)
  }
  stage = 'invalid secret inputs fail closed'
  for (const invalid of [
    ['--env', 'NEOPLE_API_KEY=', '--env', 'NEOPLE_API_KEY_FILE=/run/missing-secret'],
    ['--env', 'NEOPLE_API_KEY='],
    ['--env', 'NEOPLE_API_KEY_FILE=/run/missing-secret'],
    ['--env', 'NEOPLE_API_KEY=synthetic', '--env', 'NEOPLE_API_KEY_FILE=/run/missing-secret']
  ]) {
    const result = await docker(
      [
        'run',
        '--rm',
        '--name',
        maintenanceName,
        ...runtimeOptions,
        '--env',
        'PORT=3000',
        ...invalid,
        imageId
      ],
      { allowFailure: true }
    )
    assert.equal(result.code, 1)
    assert.equal(result.signal, null)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, 'API failed to start\n')
  }
} catch {
  process.stderr.write(`api image verification failed at ${stage}\n`)
  process.exitCode = signalCode ?? 1
} finally {
  const cleanup = [
    () => removeOwned(runtimeName),
    () => removeOwned(maintenanceName),
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
      process.stderr.write('api image test resource cleanup failed\n')
      process.exitCode = 1
    }
  }
  if (signalCode !== undefined && process.exitCode === undefined) {
    process.exitCode = signalCode
  }
}
if (process.exitCode === undefined) {
  process.stdout.write('PASS: api image ENV/FILE/legacy runtime contract and graceful stop\n')
}
