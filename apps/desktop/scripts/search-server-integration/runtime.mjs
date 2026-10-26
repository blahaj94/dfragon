import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { isolatedNeople } from '../../../api/test-support/character-search-fixtures.mjs'

const apiDirectory = fileURLToPath(new URL('../../../api/', import.meta.url))
const preload = fileURLToPath(new URL('./neople-redirect.mjs', import.meta.url))
// 이 검사가 부르는 API route template이다. 준비 확인의 `/` 요청은 `<unmatched>`로 남는다.
const searchRoute = '/characters'

async function unusedPort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)

        return
      }
      resolve()
    })
  })

  return port
}

function startApi(port, neopleOrigin) {
  // 실제 환경의 credential, NODE_OPTIONS를 상속하지 않고 명시한 fixture만 전달한다.
  const env = {
    PATH: process.env.PATH,
    PORT: String(port),
    NEOPLE_API_KEY: 'synthetic-search-key',
    DFRAGON_TEST_NEOPLE_ORIGIN: neopleOrigin
  }
  const child = spawn(
    process.execPath,
    ['--import', 'reflect-metadata', '--import', preload, 'dist/main.js'],
    { cwd: apiDirectory, env, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.setEncoding('utf8').on('data', (chunk) => {
    stderr += chunk
  })
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }))
  })

  return { child, exited }
}

async function waitForApi(port, runtime) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    assert.equal(runtime.child.exitCode, null, 'API exited before listening')
    try {
      await fetch(`http://127.0.0.1:${port}/`)

      return
    } catch {
      await delay(20)
    }
  }
  assert.fail('API did not listen within the test deadline')
}

// API 접근 로그가 쓰는 필드다. 이 밖의 필드가 있는 줄은 접근 로그로 보지 않는다.
const accessLogFields = new Set([
  'time',
  'service',
  'method',
  'route',
  'status',
  'code',
  'errorChain',
  'durationMs',
  'correlationId',
  'aborted'
])

// 접근 로그 JSON 줄만 골라 낸다. 그 밖의 출력은 그대로 남겨 빈 출력 검사가 막는다.
function separateAccessLogs(stdout) {
  const accessLogs = []
  let otherOutput = ''
  for (const line of stdout.split('\n')) {
    if (line === '') {
      continue
    }
    try {
      const entry = JSON.parse(line)
      const hasOnlyAccessLogFields =
        entry !== null &&
        typeof entry === 'object' &&
        Object.keys(entry).every((key) => accessLogFields.has(key))
      if (hasOnlyAccessLogFields && entry.service === 'api' && typeof entry.route === 'string') {
        accessLogs.push(entry)
        continue
      }
    } catch {}
    otherOutput += `${line}\n`
  }

  return { accessLogs, otherOutput }
}

/**
 * @param {(context: {
 *   base: string,
 *   neople: Omit<Awaited<ReturnType<typeof isolatedNeople>>, 'upstream'> & { upstream: { body: unknown } }
 * }) => Promise<void>} operation
 */
export async function withSearchServer(operation) {
  const neople = await isolatedNeople()
  try {
    const port = await unusedPort()
    const runtime = startApi(port, neople.origin)
    try {
      await waitForApi(port, runtime)
      await operation({ base: `http://127.0.0.1:${port}`, neople })
      runtime.child.kill('SIGTERM')
      const result = await runtime.exited
      assert.equal(result.code, 0, 'API must exit cleanly')
      assert.equal(result.signal, null)
      const { accessLogs, otherOutput } = separateAccessLogs(result.stdout)
      assert.equal(otherOutput, '', 'API must not log raw fixture data')
      assert.equal(result.stderr, '', 'API must not log raw fixture data')
      const hasSearchAccessLog = accessLogs.some(({ route }) => route === searchRoute)
      assert(hasSearchAccessLog, 'API must write an access log for public search')
    } finally {
      if (runtime.child.exitCode === null && runtime.child.signalCode === null) {
        runtime.child.kill('SIGKILL')
      }
      await runtime.exited
    }
    assert.equal(neople.upstream.failure, undefined)
  } finally {
    await neople.close()
  }
}
