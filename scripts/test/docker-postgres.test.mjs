import assert from 'node:assert/strict'
import test from 'node:test'
import { Buffer } from 'node:buffer'
import childProcess from 'node:child_process'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { writeFileSync } from 'node:fs'
import fsPromises, { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { gzipSync } from 'node:zlib'
import * as postgres from '../test-support/docker-postgres.mjs'

test('container identity accepts verified classic and containerd image IDs and rejects substitution', () => {
  const configDigest = `sha256:${'a'.repeat(64)}`
  for (const imageId of [configDigest, postgres.POSTGRES_INDEX_DIGEST]) {
    const verifiedImage = { imageId, configDigest }
    assert.doesNotThrow(() => postgres.assertContainerImageId(imageId, verifiedImage))
    assert.throws(() => postgres.assertContainerImageId(`sha256:${'b'.repeat(64)}`, verifiedImage))
  }
})

test('saved archive config names support classic JSON and containerd blob paths', () => {
  const hash = 'a'.repeat(64)
  assert.equal(postgres.archiveConfigDigest(`${hash}.json`), `sha256:${hash}`)
  assert.equal(postgres.archiveConfigDigest(`blobs/sha256/${hash}`), `sha256:${hash}`)
  assert.throws(() => postgres.archiveConfigDigest('unexpected.json'))
})

const configHash = 'a'.repeat(64)
const manifestBytes = Buffer.from(JSON.stringify([{ Config: `${configHash}.json` }]))
const manifestLimit = 1024 * 1024

// Raw headers allow checksum, size, extension and truncation faults independently
// of the production parser. Fixtures never extract archive entries.
function tarHeader({ name, size = 0, type = '0', prefix = '', sizeBytes }) {
  const header = Buffer.alloc(512)
  header.write(name, 0, 100)
  header.write('0000644\0', 100)
  header.write('0000000\0', 108)
  header.write('0000000\0', 116)
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 12)
  const hasRawSize = sizeBytes != null
  if (hasRawSize) {
    sizeBytes.copy(header, 124)
  }
  header.write('00000000000\0', 136)
  header.fill(32, 148, 156)
  header.write(type, 156)
  header.write('ustar\0', 257)
  header.write('00', 263)
  header.write(prefix, 345, 155)
  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148)

  return header
}

function tarEntry({ name = 'manifest.json', content = manifestBytes, ...header }) {
  const bytes = Buffer.from(content)
  const padding = Buffer.alloc((512 - (bytes.length % 512)) % 512)

  return Buffer.concat([tarHeader({ name, size: bytes.length, ...header }), bytes, padding])
}

function tarArchive(...entries) {
  return Buffer.concat([...entries, Buffer.alloc(1024)])
}

function paxRecord({ key, value }) {
  const record = `${key}=${value}\n`
  let length = Buffer.byteLength(record) + 2
  while (true) {
    const nextLength = Buffer.byteLength(`${length} ${record}`)
    const isLengthStable = nextLength === length
    if (isLengthStable) {
      return `${length} ${record}`
    }
    length = nextLength
  }
}

async function withArchive({ t, bytes, check }) {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-tar-test-'))
  const archivePath = join(directory, 'image.tar')
  const handles = []
  const originalOpen = fsPromises.open
  t.mock.method(fsPromises, 'open', async (...args) => {
    const handle = await originalOpen(...args)
    handles.push(handle)

    return handle
  })
  syncBuiltinESMExports()
  try {
    await writeFile(archivePath, bytes)
    await check(archivePath)
    assert.deepEqual(await readdir(directory), ['image.tar'], 'entries must not be extracted')
    assert.equal(handles.length, 1)
    for (const handle of handles) {
      assert.equal(handle.fd, -1, 'archive handle must close before settlement')
    }
  } finally {
    t.mock.restoreAll()
    syncBuiltinESMExports()
    await rm(directory, { recursive: true, force: true })
  }
}

async function acceptsArchive(t, bytes) {
  await withArchive({
    t,
    bytes,
    check: async (path) => {
      assert.equal(await postgres.readArchiveConfigDigest(path), `sha256:${configHash}`)
    }
  })
}

async function rejectsArchive({ t, bytes, error }) {
  await withArchive({
    t,
    bytes,
    check: (path) => assert.rejects(postgres.readArchiveConfigDigest(path), error)
  })
}

test('preserves padding boundaries before and after the manifest and drains large layers', async (t) => {
  for (const size of [0, 1, 511, 512, 513, 2 * manifestLimit + 1]) {
    await t.test(`layer size ${size}`, async (t) => {
      const layer = tarEntry({ name: 'layer.tar', content: Buffer.alloc(size, 7) })
      await acceptsArchive(t, tarArchive(layer, tarEntry({}), layer))
    })
  }
})

test('preserves JSON first-config semantics and both config path formats', async (t) => {
  for (const Config of [`${configHash}.json`, `blobs/sha256/${configHash}`]) {
    await t.test(Config, async (t) => {
      const content = JSON.stringify([{ Config, extra: true }, { Config: 'ignored.json' }])
      await acceptsArchive(t, tarArchive(tarEntry({ content })))
    })
  }
})

test('preserves rejection of missing manifest, incomplete manifest and invalid JSON/config', async (t) => {
  const cases = [
    {
      name: 'missing',
      bytes: tarArchive(tarEntry({ name: 'layer' })),
      error: /manifest is missing/
    },
    {
      name: 'truncated manifest',
      bytes: Buffer.concat([tarHeader({ name: 'manifest.json', size: 2048 }), manifestBytes])
    },
    { name: 'JSON', bytes: tarArchive(tarEntry({ content: '{' })), error: SyntaxError },
    {
      name: 'empty array',
      bytes: tarArchive(tarEntry({ content: '[]' })),
      error: /config is missing/
    },
    {
      name: 'nonstring config',
      bytes: tarArchive(tarEntry({ content: '[{"Config":1}]' })),
      error: /config is missing/
    },
    {
      name: 'invalid digest',
      bytes: tarArchive(tarEntry({ content: '[{"Config":"bad.json"}]' })),
      error: assert.AssertionError
    }
  ]
  for (const { name, ...fixture } of cases) {
    await t.test(name, (t) => rejectsArchive({ t, ...fixture }))
  }
})

test('accepts a manifest at the exact 1 MiB byte boundary', async (t) => {
  const content = Buffer.concat([
    manifestBytes,
    Buffer.alloc(manifestLimit - manifestBytes.length, 32)
  ])
  await acceptsArchive(t, tarArchive(tarEntry({ content })))
})

test('rejects a manifest one byte above 1 MiB', async (t) => {
  const content = Buffer.concat([
    manifestBytes,
    Buffer.alloc(manifestLimit + 1 - manifestBytes.length, 32)
  ])
  await rejectsArchive({ t, bytes: tarArchive(tarEntry({ content })), error: /manifest.*limit/i })
})

test('rejects duplicate manifests even after a drained layer', async (t) => {
  const bytes = tarArchive(
    tarEntry({}),
    tarEntry({ name: 'layer', content: Buffer.alloc(70000) }),
    tarEntry({})
  )
  await rejectsArchive({ t, bytes, error: /duplicate.*manifest/i })
})

test('uses PAX and GNU effective paths instead of raw header names', async (t) => {
  const extensions = [
    { name: 'PaxHeader', type: 'x', content: paxRecord({ key: 'path', value: 'manifest.json' }) },
    { name: '././@LongLink', type: 'L', content: 'manifest.json\0' }
  ]
  for (const extension of extensions) {
    await t.test(extension.type, async (t) => {
      await acceptsArchive(t, tarArchive(tarEntry(extension), tarEntry({ name: 'placeholder' })))
    })
  }
  await t.test('PAX renames raw manifest away', async (t) => {
    const extension = tarEntry({
      name: 'PaxHeader',
      type: 'x',
      content: paxRecord({ key: 'path', value: 'other.json' })
    })
    await rejectsArchive({
      t,
      bytes: tarArchive(extension, tarEntry({})),
      error: /manifest is missing/
    })
  })
  await t.test('ustar prefix is part of path', async (t) => {
    await rejectsArchive({
      t,
      bytes: tarArchive(tarEntry({ prefix: 'nested' })),
      error: /manifest is missing/
    })
  })
  await t.test('effective path duplicate', async (t) => {
    const extension = tarEntry(extensions[0])
    await rejectsArchive({
      t,
      bytes: tarArchive(tarEntry({}), extension, tarEntry({ name: 'alias' })),
      error: /duplicate.*manifest/i
    })
  })
})

test('uses PAX size for framing and the manifest limit', async (t) => {
  await t.test('size overrides raw header', async (t) => {
    const extension = tarEntry({
      name: 'PaxHeader',
      type: 'x',
      content: paxRecord({ key: 'size', value: manifestBytes.length })
    })
    await acceptsArchive(t, tarArchive(extension, tarEntry({ size: 1 })))
  })
  await t.test('oversized declared manifest', async (t) => {
    const extension = tarEntry({
      name: 'PaxHeader',
      type: 'x',
      content: paxRecord({ key: 'size', value: manifestLimit + 1 })
    })
    await rejectsArchive({
      t,
      bytes: tarArchive(extension, tarEntry({})),
      error: /manifest.*limit/i
    })
  })
})

test('follows gzip interpretation and rejects compression corruption after the manifest', async (t) => {
  const bytes = gzipSync(tarArchive(tarEntry({})))
  await t.test('gzip archive', (t) => acceptsArchive(t, bytes))
  await t.test('broken gzip trailer', async (t) => {
    const corrupt = Buffer.from(bytes)
    corrupt[corrupt.length - 8] ^= 0xff
    await rejectsArchive({ t, bytes: corrupt })
  })
})

test('rejects parser-detected header and body corruption across the whole archive', async (t) => {
  const badChecksum = tarHeader({ name: 'layer' })
  badChecksum[0] ^= 1
  const badSize = tarHeader({
    name: 'layer',
    sizeBytes: Buffer.from([0x80, ...Array(11).fill(0xff)])
  })
  // A complete nonmanifest header promises a body the archive does not supply.
  const truncatedLayer = Buffer.concat([tarHeader({ name: 'layer', size: 2048 }), Buffer.alloc(10)])
  const cases = [
    { name: 'checksum before manifest', bytes: tarArchive(badChecksum, tarEntry({})) },
    { name: 'checksum after manifest', bytes: tarArchive(tarEntry({}), badChecksum) },
    { name: 'parser size error', bytes: tarArchive(tarEntry({}), badSize) },
    { name: 'truncated layer after manifest', bytes: Buffer.concat([tarEntry({}), truncatedLayer]) }
  ]
  for (const { name, bytes } of cases) {
    await t.test(name, (t) => rejectsArchive({ t, bytes }))
  }
})

test('closes the archive on read errors and reports open failures', async (t) => {
  await withArchive({
    t,
    bytes: Buffer.alloc(0),
    check: async (path) => {
      const directory = dirname(path)
      await assert.rejects(postgres.readArchiveConfigDigest(join(directory, 'missing')), {
        code: 'ENOENT'
      })
      await assert.rejects(postgres.readArchiveConfigDigest(directory), { code: 'EISDIR' })
    }
  })
})

test('removes the temporary saved archive on success, parser/JSON failure and Docker save failure', async (t) => {
  const cases = [
    { name: 'success', bytes: tarArchive(tarEntry({})) },
    { name: 'JSON failure', bytes: tarArchive(tarEntry({ content: '{' })), error: SyntaxError },
    {
      name: 'parser failure',
      bytes: Buffer.concat([tarEntry({}), tarHeader({ name: 'layer', size: 2048 })]),
      error: Error
    },
    {
      name: 'save failure',
      bytes: Buffer.alloc(10),
      saveCode: 1,
      error: { message: 'Docker command failed: image save (exit code 1)' }
    }
  ]
  for (const { name, bytes, saveCode = 0, error } of cases) {
    await t.test(name, async (t) => {
      let savedPath
      const childDigest = postgres.POSTGRES_CHILD_DIGESTS['linux/arm64/v8']
      t.mock.method(childProcess, 'spawn', (program, args) => {
        assert.equal(program, 'docker')
        const child = new EventEmitter()
        child.stdout = new PassThrough()
        child.stderr = new PassThrough()
        const operation = args.slice(0, 2).join(' ')
        let output = ''
        let code = 0
        switch (operation) {
          case 'info --format':
            output = '"linux" "aarch64" "29.7.2"'
            break
          case 'buildx imagetools': {
            const isChildRequest = args.includes('--raw')
            const metadata = isChildRequest
              ? {
                  mediaType: 'application/vnd.oci.image.manifest.v1+json',
                  config: { digest: `sha256:${configHash}` }
                }
              : {
                  mediaType: 'application/vnd.oci.image.index.v1+json',
                  digest: postgres.POSTGRES_INDEX_DIGEST,
                  manifests: [
                    {
                      digest: childDigest,
                      platform: { os: 'linux', architecture: 'arm64', variant: 'v8' }
                    }
                  ]
                }
            output = JSON.stringify(metadata)
            break
          }
          case 'pull --platform':
            break
          case 'image inspect':
            output = `${JSON.stringify([`postgres@${postgres.POSTGRES_INDEX_DIGEST}`])} "linux" "arm64" {"/var/lib/postgresql":{}} "${postgres.POSTGRES_INDEX_DIGEST}"`
            break
          case 'image save':
            savedPath = args[3]
            writeFileSync(savedPath, bytes)
            code = saveCode
            break
          default:
            assert.fail(`Unexpected Docker fixture operation: ${operation}`)
        }
        queueMicrotask(() => {
          child.stdout.end(output)
          child.stderr.end()
          child.emit('close', code, null)
        })

        return child
      })
      syncBuiltinESMExports()
      try {
        const shouldReject = error != null
        if (shouldReject) {
          await assert.rejects(postgres.verifyApprovedImage(), error)
        } else {
          const verified = await postgres.verifyApprovedImage()
          assert.equal(verified.configDigest, `sha256:${configHash}`)
        }
        assert.equal(typeof savedPath, 'string')
        await assert.rejects(fsPromises.stat(dirname(savedPath)), { code: 'ENOENT' })
      } finally {
        t.mock.restoreAll()
        syncBuiltinESMExports()
      }
    })
  }
})

function finishCommand(child, { stdout = '', stderr = '', code = 0, signal = null } = {}) {
  child.stdout.end(stdout)
  child.stderr.end(stderr)
  child.emit('close', code, signal)
}

function mockCommand(t, start) {
  const signals = []
  t.mock.method(childProcess, 'spawn', (program, args, options) => {
    const child = new EventEmitter()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = (signal) => {
      signals.push(signal)
      queueMicrotask(() => finishCommand(child, { code: null, signal }))

      return true
    }
    queueMicrotask(() => start(child, { program, args, options }))

    return child
  })
  syncBuiltinESMExports()
  t.after(() => {
    t.mock.restoreAll()
    syncBuiltinESMExports()
  })

  return signals
}

const fixtureRunId = 'helper12345678'
const fixtureName = 'dfragon-db-helper12345678'
const fixtureImageId = `sha256:${'c'.repeat(64)}`
const fixtureImage = { platform: 'linux/amd64', imageId: fixtureImageId }

// Emulate Docker CLI state at the subprocess boundary, including volume-create
// idempotency and refusing to remove a volume mounted by a live container.
function mockDocker(t, { containers = new Map(), volumes = new Map(), respond } = {}) {
  const removals = []
  const creations = []
  const runOptions = []
  const commands = []
  mockCommand(t, (child, { program, args }) => {
    assert.equal(program, 'docker')
    commands.push(args[0])
    let result = respond?.({ args, containers, volumes })
    if (result === undefined) {
      result = { stdout: '' }
      const [kind, operation] = args
      if (operation === 'ls') {
        const filter = args[args.indexOf('--filter') + 1].slice('name='.length)
        const pattern = new RegExp(filter)
        const names = kind === 'container' ? containers.keys() : volumes.keys()
        const matching = [...names].filter((name) => {
          const dockerName = kind === 'container' ? `/${name}` : name

          return pattern.test(dockerName)
        })
        result.stdout = matching.join('\n')
      } else if (operation === 'inspect') {
        const name = args[2]
        const resource = kind === 'container' ? containers.get(name) : volumes.get(name)
        if (resource === undefined) {
          result.code = 1
        } else if (args.at(-1).includes('Labels')) {
          result.stdout = resource.runId ?? ''
        } else {
          result.stdout = `${JSON.stringify(resource.imageId)} "linux" ${JSON.stringify(resource.mounts)}`
        }
      } else if (kind === 'volume' && operation === 'create') {
        const name = args.at(-1)
        const runId = args[args.indexOf('--label') + 1].split('=')[1]
        if (!volumes.has(name)) {
          volumes.set(name, { runId })
        }
        creations.push(['volume', name])
        result.stdout = name
      } else if (kind === 'run') {
        const name = args[args.indexOf('--name') + 1]
        const runId = args[args.indexOf('--label') + 1].split('=')[1]
        const mount = args[args.indexOf('--mount') + 1]
        const volume = mount.match(/source=([^,]+)/)[1]
        const destination = mount.match(/target=([^,]+)/)[1]
        const platform = args[args.indexOf('--platform') + 1]
        const publish = args[args.indexOf('--publish') + 1]
        const pgdata = args.find((argument) => argument.startsWith('PGDATA='))
        const image = args.at(-1)
        runOptions.push({ platform, publish, mount, pgdata, image })
        containers.set(name, {
          runId,
          imageId: fixtureImageId,
          mounts: [{ Type: 'volume', Name: volume, Destination: destination }]
        })
        creations.push(['container', name])
        result.stdout = 'fixture-container-id'
      } else if (kind === 'exec') {
        result.stdout = 'x86_64\n'
      } else if (kind === 'port') {
        result.stdout = '127.0.0.1:49152\n'
      } else if (kind === 'rm') {
        const name = args.at(-1)
        removals.push(['container', name])
        containers.delete(name)
      } else if (kind === 'volume' && operation === 'rm') {
        const name = args.at(-1)
        removals.push(['volume', name])
        const mounted = [...containers.values()].some((container) =>
          container.mounts?.some((mount) => mount.Name === name)
        )
        if (mounted) {
          result.code = 1
        } else {
          volumes.delete(name)
        }
      } else {
        assert.fail(`Unexpected Docker fixture operation: ${kind} ${operation}`)
      }
    }
    finishCommand(child, result)
  })

  return { containers, volumes, removals, creations, runOptions, commands }
}

test('명령 결과는 종료 코드와 signal 및 두 출력 스트림을 그대로 전달한다', async (t) => {
  mockCommand(t, (child, { program, args, options }) => {
    assert.equal(program, 'fixture-command')
    assert.deepEqual(args, ['first', 'second'])
    assert.equal(options.cwd, '/fixture')
    assert.deepEqual(options.env, { FIXTURE_ONLY: 'value' })
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe'])
    child.stdout.write('앞부분 ')
    child.stderr.write('경고 ')
    finishCommand(child, { stdout: '뒷부분', stderr: '완료', code: 7, signal: 'SIGTERM' })
  })
  assert.deepEqual(
    await postgres.command('fixture-command', ['first', 'second'], {
      cwd: '/fixture',
      env: { FIXTURE_ONLY: 'value' }
    }),
    { code: 7, signal: 'SIGTERM', stdout: '앞부분 뒷부분', stderr: '경고 완료' }
  )
})

function setSyntheticEnvironment(t, values) {
  for (const [name, value] of Object.entries(values)) {
    const previous = process.env[name]
    process.env[name] = value
    t.after(() => {
      if (previous === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = previous
      }
    })
  }
}

test('기본 Docker 환경은 CLI 설정 위치를 전달하고 상위 프로세스 credential은 전달하지 않는다', async (t) => {
  // DOCKER_CONFIG를 넘기지 않으면 설정 위치를 옮겨 HOME/.docker에 buildx가 없는 환경에서 이미지 검증이 실패한다.
  setSyntheticEnvironment(t, {
    DOCKER_CONFIG: '/synthetic/docker-config',
    DOCKER_AUTH_CONFIG: 'synthetic-auth-config',
    DFRAGON_TEST_SYNTHETIC_SECRET: 'synthetic-fixture'
  })
  const allowedNames = new Set([
    'PATH',
    'HOME',
    'DOCKER_CONFIG',
    'DOCKER_HOST',
    'DOCKER_CONTEXT',
    'DOCKER_TLS_VERIFY',
    'DOCKER_CERT_PATH'
  ])
  let environment
  mockCommand(t, (child, { options }) => {
    environment = options.env
    finishCommand(child)
  })
  assert.deepEqual(await postgres.docker(['info']), {
    code: 0,
    signal: null,
    stdout: '',
    stderr: ''
  })
  assert.equal(environment.DOCKER_CONFIG, '/synthetic/docker-config')
  assert.equal(Object.hasOwn(environment, 'DOCKER_AUTH_CONFIG'), false)
  assert.equal(Object.hasOwn(environment, 'DFRAGON_TEST_SYNTHETIC_SECRET'), false)
  for (const name of Object.keys(environment)) {
    assert.equal(allowedNames.has(name), true)
    assert.equal(environment[name], process.env[name])
  }
})

test('명령 시작 실패는 외부 오류와 출력을 노출하지 않고 거절한다', async (t) => {
  mockCommand(t, (child) => {
    child.emit('error', new Error('synthetic-private-detail'))
    finishCommand(child, { code: -2, stderr: 'synthetic-private-detail' })
  })
  await assert.rejects(postgres.command('fixture-command', []), {
    message: 'Command failed to start'
  })
})

test('명령 timeout은 자식에게 SIGKILL을 보내고 오류로 전파한다', async (t) => {
  const signals = mockCommand(t, () => {})
  await assert.rejects(postgres.command('fixture-command', [], { timeoutMs: 1 }), {
    message: 'Command timed out'
  })
  assert.deepEqual(signals, ['SIGKILL'])
})

test('allowFailure를 허용해도 Docker 명령 timeout은 실패로 전파한다', async (t) => {
  const signals = mockCommand(t, () => {})
  await assert.rejects(postgres.docker(['run'], { allowFailure: true, timeoutMs: 1 }), {
    message: 'Docker command failed: run (Command timed out)'
  })
  assert.deepEqual(signals, ['SIGKILL'])
})

test('명령 출력 한도는 문자 수 대신 UTF-8 byte 경계에서 적용한다', async (t) => {
  const limit = 1024 * 1024
  for (const stream of ['stdout', 'stderr']) {
    await t.test(`${stream}은 정확한 한도를 허용한다`, async (t) => {
      const output = `${'가'.repeat(Math.floor(limit / 3))}x`
      mockCommand(t, (child) => finishCommand(child, { [stream]: output }))
      const result = await postgres.command('fixture-command', [])
      assert.equal(result[stream], output)
      assert.equal(Buffer.byteLength(result[stream]), limit)
    })
    await t.test(`${stream}은 한 byte 초과를 거절한다`, async (t) => {
      const output = `${'가'.repeat(Math.floor(limit / 3))}xx`
      const signals = mockCommand(t, (child) => child[stream].write(output))
      await assert.rejects(postgres.command('fixture-command', []), {
        message: 'Command output limit exceeded'
      })
      assert.deepEqual(signals, ['SIGKILL'])
    })
  }
})

test('Docker의 실패 코드와 signal은 기본 거절하며 allowFailure에서 결과를 보존한다', async (t) => {
  for (const { status, ...result } of [
    { code: 1, signal: null, status: 'exit code 1' },
    { code: null, signal: 'SIGTERM', status: 'signal SIGTERM' },
    { code: 0, signal: 'SIGTERM', status: 'signal SIGTERM' }
  ]) {
    await t.test(`종료 code=${result.code}, signal=${result.signal}`, async (t) => {
      mockCommand(t, (child) => finishCommand(child, { ...result, stderr: 'synthetic-stderr' }))
      await assert.rejects(postgres.docker(['run']), {
        message: `Docker command failed: run (${status})\n  synthetic-stderr`
      })
      assert.deepEqual(await postgres.docker(['run'], { allowFailure: true }), {
        ...result,
        stdout: '',
        stderr: 'synthetic-stderr'
      })
    })
  }
})

test('Docker 실패 오류는 이미지 이름 없이 하위 명령과 stderr의 첫 두 줄, 마지막 세 줄을 담는다', async (t) => {
  // buildx plugin이 없으면 Docker CLI가 첫 줄에 원인을 쓰고 사용법 전체를 이어 출력한다.
  const longLine = `long ${'x'.repeat(400)}`
  mockCommand(t, (child) =>
    finishCommand(child, {
      code: 125,
      stderr: [
        'unknown flag: --format',
        "See 'docker --help'.",
        '',
        'Usage:  docker [OPTIONS] COMMAND',
        'omitted usage line',
        'progress 50%\rprogress 100%',
        '\u001b[31mcolored\tline   ',
        longLine,
        ''
      ].join('\n')
    })
  )
  await assert.rejects(
    postgres.docker([
      'buildx',
      'imagetools',
      'inspect',
      postgres.POSTGRES_IMAGE,
      '--format',
      '{{json .Manifest}}'
    ]),
    {
      message: [
        'Docker command failed: buildx imagetools inspect (exit code 125)',
        '  unknown flag: --format',
        "  See 'docker --help'.",
        '  … 3 lines omitted',
        '  progress 100%',
        '   [31mcolored line',
        `  ${longLine.slice(0, 300)}…`
      ].join('\n')
    }
  )
})

test('docker run 실패 stderr가 --env 인자를 되풀이해도 DB 계정과 비밀번호를 출력하지 않는다', async (t) => {
  let username
  let password
  const environmentValue = (args, name) =>
    args.find((argument) => argument.startsWith(`${name}=`)).slice(name.length + 1)
  const state = mockDocker(t, {
    respond: ({ args }) => {
      const isRun = args[0] === 'run'
      if (isRun) {
        username = environmentValue(args, 'POSTGRES_USER')
        password = environmentValue(args, 'POSTGRES_PASSWORD')

        // Docker CLI의 flag 해석 오류처럼 인자를 그대로 되풀이하는 stderr를 흉내 낸다.

        return {
          code: 125,
          stderr: [
            `docker: invalid argument "POSTGRES_PASSWORD=${password}" for "-e, --env" flag: synthetic`,
            `connecting postgres://${username}:${password}@127.0.0.1:5432/dfragon_auth_test`,
            `raw ${password} for ${username}`,
            "See 'docker run --help'."
          ].join('\n')
        }
      }
    }
  })
  await assert.rejects(postgres.createPostgres(fixtureRunId, fixtureImage), (error) => {
    assert.equal(
      error.message,
      [
        'Docker command failed: run (exit code 125)',
        '  docker: invalid argument "POSTGRES_PASSWORD=[redacted]" for "-e, --env" flag: synthetic',
        '  connecting postgres://[redacted]@127.0.0.1:5432/[redacted]',
        '  raw [redacted] for [redacted]',
        "  See 'docker run --help'."
      ].join('\n')
    )

    return true
  })
  assert.match(password, /^[a-zA-Z0-9_-]{43}$/)
  assert.equal(state.volumes.size, 0)
})

test('--env 값이 비었거나 이름만 넘기면 stderr를 바꾸지 않고 다른 --env 형식의 값은 가린다', async (t) => {
  mockCommand(t, (child) =>
    finishCommand(child, {
      code: 1,
      stderr: 'conflict: inline-value short-value INHERITED EMPTY='
    })
  )
  await assert.rejects(
    postgres.docker([
      'run',
      '--env',
      'EMPTY=',
      '--env',
      'INHERITED',
      '--env=INLINE=inline-value',
      '-e',
      'SHORT=short-value',
      'image'
    ]),
    {
      message: [
        'Docker command failed: run (exit code 1)',
        '  conflict: [redacted] [redacted] INHERITED EMPTY='
      ].join('\n')
    }
  )
})

test('Docker stderr의 연결 문자열 credential과 비밀 이름 값은 가리고 일반 진단 문장은 보존한다', async (t) => {
  mockCommand(t, (child) =>
    finishCommand(child, {
      code: 1,
      stderr: [
        'failed to fetch oauth token: unexpected status: 401 Unauthorized',
        'Get "https://auth.docker.io/token?scope=repository%3Alibrary%2Fpostgres%3Apull": EOF',
        'proxy https://proxy-user:proxy-pass@proxy.example.test:3128 refused',
        `DB_PASSWORD=env-secret password="quoted-secret" "refreshToken":"json-secret" apiKey: 'inspect-secret'`,
        'FATAL: password authentication failed for user "fixture"'
      ].join('\n')
    })
  )
  await assert.rejects(
    postgres.docker(['pull', '--platform', 'linux/amd64', postgres.POSTGRES_IMAGE]),
    {
      message: [
        'Docker command failed: pull (exit code 1)',
        '  failed to fetch oauth token: unexpected status: 401 Unauthorized',
        '  Get "https://auth.docker.io/token?scope=repository%3Alibrary%2Fpostgres%3Apull": EOF',
        '  proxy https://[redacted]@proxy.example.test:3128 refused',
        `  DB_PASSWORD=[redacted] password="[redacted]" "refreshToken":"[redacted]" apiKey: '[redacted]'`,
        '  FATAL: password authentication failed for user "fixture"'
      ].join('\n')
    }
  )
})

test('PostgreSQL 생성과 정리는 정확한 자원만 사용하고 이웃 이름의 자원을 보존한다', async (t) => {
  const neighbor = `${fixtureName}-neighbor`
  const protectedContainer = { runId: 'different12345678' }
  const protectedVolume = { runId: 'different12345678' }
  const state = mockDocker(t, {
    containers: new Map([[neighbor, protectedContainer]]),
    volumes: new Map([[neighbor, protectedVolume]])
  })
  const resources = await postgres.createPostgres(fixtureRunId, fixtureImage)
  assert.equal(resources.runId, fixtureRunId)
  assert.equal(resources.containerName, fixtureName)
  assert.equal(resources.volumeName, fixtureName)
  assert.equal(resources.configuration.host, '127.0.0.1')
  assert.equal(resources.configuration.port, 49152)
  assert.equal(resources.configuration.database, 'dfragon_auth_test')
  assert.match(resources.configuration.username, /^dfragon_[a-f0-9]{20}$/)
  assert.match(resources.configuration.password, /^[a-zA-Z0-9_-]{43}$/)
  assert.equal(state.containers.get(fixtureName).runId, fixtureRunId)
  assert.equal(state.volumes.get(fixtureName).runId, fixtureRunId)
  assert.deepEqual(state.runOptions, [
    {
      platform: 'linux/amd64',
      publish: '127.0.0.1::5432',
      mount: `type=volume,source=${fixtureName},target=/var/lib/postgresql`,
      pgdata: 'PGDATA=/var/lib/postgresql/18/docker',
      image: postgres.POSTGRES_IMAGE
    }
  ])

  await postgres.teardownPostgres(resources)
  await postgres.assertResourcesAbsent(fixtureRunId)
  await postgres.teardownPostgres(resources)
  assert.deepEqual(state.removals, [
    ['container', fixtureName],
    ['volume', fixtureName]
  ])
  assert.deepEqual([...state.containers], [[neighbor, protectedContainer]])
  assert.deepEqual([...state.volumes], [[neighbor, protectedVolume]])
})

test('기존 container나 volume은 소유권이 같아도 재사용하거나 삭제하지 않는다', async (t) => {
  for (const kind of ['container', 'volume']) {
    await t.test(`${kind} 이름 충돌`, async (t) => {
      const protectedResource = { runId: fixtureRunId }
      const containers = new Map()
      const volumes = new Map()
      const resources = kind === 'container' ? containers : volumes
      resources.set(fixtureName, protectedResource)
      const state = mockDocker(t, { containers, volumes })
      await assert.rejects(postgres.createPostgres(fixtureRunId, fixtureImage), {
        message: `Database test ${kind} already exists`
      })
      assert.equal(resources.get(fixtureName), protectedResource)
      assert.deepEqual(state.creations, [])
      assert.deepEqual(state.removals, [])
    })
  }
})

test('잘못된 run ID는 Docker를 호출하거나 자원을 만들기 전에 거절한다', async (t) => {
  const state = mockDocker(t)
  for (const runId of ['', 'SHORT', 'invalid-name', 'a'.repeat(81)]) {
    await assert.rejects(postgres.createPostgres(runId, fixtureImage), {
      message: 'Invalid database test run ID'
    })
  }
  assert.equal(state.containers.size, 0)
  assert.equal(state.volumes.size, 0)
  assert.deepEqual(state.commands, [])
  assert.deepEqual(state.creations, [])
  assert.deepEqual(state.removals, [])
})

test('사전 조회 뒤 동명 volume이 생기면 소유권을 다시 확인하고 외부 자원을 보존한다', async (t) => {
  const protectedVolume = { runId: 'protected12345678' }
  const state = mockDocker(t, {
    respond: ({ args, volumes }) => {
      if (args[0] === 'volume' && args[1] === 'create') {
        // Docker returns an existing volume even when create requested other labels.
        volumes.set(fixtureName, protectedVolume)

        return { stdout: fixtureName }
      }
    }
  })
  await assert.rejects(postgres.createPostgres(fixtureRunId, fixtureImage), (error) => {
    assert.equal(error instanceof AggregateError, true)
    assert.equal(error.errors[0] instanceof assert.AssertionError, true)
    assert.equal(error.errors[1] instanceof AggregateError, true)
    assert.equal(error.errors[1].errors[0].message, 'Database test resource ownership mismatch')

    return true
  })
  assert.equal(state.volumes.get(fixtureName), protectedVolume)
  assert.equal(state.containers.size, 0)
  assert.deepEqual(state.removals, [])
})

test('Docker 생성과 runtime 검증이 실패하면 앞서 만든 자원을 정리한다', async (t) => {
  const cases = [
    {
      name: 'volume 생성 실패',
      matches: (args) => args[0] === 'volume' && args[1] === 'create',
      result: { code: 1 },
      error: { message: 'Docker command failed: volume create (exit code 1)' },
      removals: []
    },
    {
      name: 'container 생성 실패',
      matches: (args) => args[0] === 'run',
      result: { code: 1 },
      error: { message: 'Docker command failed: run (exit code 1)' },
      removals: [['volume', fixtureName]]
    },
    {
      name: 'container 메타데이터 형식 오류',
      matches: (args) => args[0] === 'container' && args.at(-1).includes('.Image'),
      result: { stdout: '{}' },
      error: { message: 'Database container metadata could not be determined' }
    },
    {
      name: '검증된 이미지 대신 다른 이미지 실행',
      matches: (args) => args[0] === 'container' && args.at(-1).includes('.Image'),
      result: {
        stdout: `"sha256:${'d'.repeat(64)}" "linux" [{"Type":"volume","Name":"${fixtureName}","Destination":"/var/lib/postgresql"}]`
      },
      error: assert.AssertionError
    },
    {
      name: '소유 volume 대신 bind mount 사용',
      matches: (args) => args[0] === 'container' && args.at(-1).includes('.Image'),
      result: {
        stdout: `"${fixtureImageId}" "linux" [{"Type":"bind","Name":"${fixtureName}","Destination":"/var/lib/postgresql"}]`
      },
      error: assert.AssertionError
    },
    {
      name: '컨테이너 architecture 불일치',
      matches: (args) => args[0] === 'exec',
      result: { stdout: 'aarch64\n' },
      error: assert.AssertionError
    },
    {
      name: 'loopback 대신 공개 interface로 포트 노출',
      matches: (args) => args[0] === 'port',
      result: { stdout: '0.0.0.0:49152\n' },
      error: { message: 'PostgreSQL loopback port could not be determined' }
    }
  ]
  for (const { name, matches, result, error, removals } of cases) {
    await t.test(name, async (t) => {
      const state = mockDocker(t, {
        respond: ({ args }) => {
          if (matches(args)) {
            return result
          }
        }
      })
      await assert.rejects(postgres.createPostgres(fixtureRunId, fixtureImage), error)
      assert.equal(state.containers.size, 0)
      assert.equal(state.volumes.size, 0)
      const expectedRemovals = removals ?? [
        ['container', fixtureName],
        ['volume', fixtureName]
      ]
      assert.deepEqual(state.removals, expectedRemovals)
    })
  }
})

test('volume 또는 container 생성 후 hook 실패는 원래 오류를 전파하고 생성 자원을 정리한다', async (t) => {
  for (const hook of ['afterVolumeCreated', 'afterContainerCreated']) {
    await t.test(`${hook}에서 소비자가 중단을 알린다`, async (t) => {
      const failure = new Error('Synthetic interruption')
      const state = mockDocker(t)
      await assert.rejects(
        postgres.createPostgres(fixtureRunId, fixtureImage, {
          [hook]: () => {
            throw failure
          }
        }),
        (error) => error === failure
      )
      assert.equal(state.containers.size, 0)
      assert.equal(state.volumes.size, 0)
      const expectedRemovals = [['volume', fixtureName]]
      if (hook === 'afterContainerCreated') {
        expectedRemovals.unshift(['container', fixtureName])
      }
      assert.deepEqual(state.removals, expectedRemovals)
    })
  }
})

test('생성 실패와 정리 실패는 함께 보존하고 남은 자원을 성공으로 보고하지 않는다', async (t) => {
  const failure = new Error('Synthetic creation failure')
  const state = mockDocker(t, {
    respond: ({ args }) => {
      if (args[0] === 'volume' && args[1] === 'rm') {
        return { code: 1 }
      }
    }
  })
  await assert.rejects(
    postgres.createPostgres(fixtureRunId, fixtureImage, {
      afterVolumeCreated: () => {
        throw failure
      }
    }),
    (error) => {
      assert.equal(error instanceof AggregateError, true)
      assert.equal(error.message, 'Database test creation and teardown failed')
      assert.equal(error.cause, failure)
      assert.equal(error.errors.length, 2)
      assert.equal(error.errors[0], failure)
      assert.equal(error.errors[1] instanceof AggregateError, true)
      assert.equal(
        error.errors[1].errors[0].message,
        'Docker command failed: volume rm (exit code 1)'
      )

      return true
    }
  )
  assert.equal(state.containers.size, 0)
  assert.equal(state.volumes.get(fixtureName).runId, fixtureRunId)
  await assert.rejects(postgres.assertResourcesAbsent(fixtureRunId), assert.AssertionError)
})

test('소유권이 다른 container는 보존하면서 독립된 소유 volume의 정리를 계속한다', async (t) => {
  const protectedContainer = { runId: 'protected12345678' }
  const state = mockDocker(t, {
    containers: new Map([[fixtureName, protectedContainer]]),
    volumes: new Map([[fixtureName, { runId: fixtureRunId }]])
  })
  await assert.rejects(
    postgres.teardownPostgres({
      runId: fixtureRunId,
      containerName: fixtureName,
      volumeName: fixtureName
    }),
    (error) => {
      assert.equal(error instanceof AggregateError, true)
      assert.equal(error.errors.length, 1)
      assert.equal(error.errors[0].message, 'Database test resource ownership mismatch')

      return true
    }
  )
  assert.equal(state.containers.get(fixtureName), protectedContainer)
  assert.equal(state.volumes.size, 0)
  assert.deepEqual(state.removals, [['volume', fixtureName]])
})

test('소유권 조회가 실패한 자원은 삭제하지 않고 다른 자원 정리를 시도한다', async (t) => {
  const state = mockDocker(t, {
    containers: new Map([[fixtureName, { runId: fixtureRunId }]]),
    volumes: new Map([[fixtureName, { runId: fixtureRunId }]]),
    respond: ({ args }) => {
      if (args[0] === 'container' && args[1] === 'inspect') {
        return { code: 1 }
      }
    }
  })
  await assert.rejects(
    postgres.teardownPostgres({
      runId: fixtureRunId,
      containerName: fixtureName,
      volumeName: fixtureName
    }),
    (error) => {
      assert.equal(error instanceof AggregateError, true)
      assert.equal(error.errors.length, 1)
      assert.equal(
        error.errors[0].message,
        'Docker command failed: container inspect (exit code 1)'
      )

      return true
    }
  )
  assert.equal(state.containers.has(fixtureName), true)
  assert.equal(state.volumes.size, 0)
  assert.deepEqual(state.removals, [['volume', fixtureName]])
})

test('삭제 명령이 성공해도 exact 자원이 남아 있으면 정리를 실패 처리한다', async (t) => {
  const state = mockDocker(t, {
    volumes: new Map([[fixtureName, { runId: fixtureRunId }]]),
    respond: ({ args }) => {
      if (args[0] === 'volume' && args[1] === 'rm') {
        return { code: 0 }
      }
    }
  })
  await assert.rejects(postgres.removeOwnedVolume(fixtureName, fixtureRunId), assert.AssertionError)
  assert.equal(state.volumes.get(fixtureName).runId, fixtureRunId)
})
