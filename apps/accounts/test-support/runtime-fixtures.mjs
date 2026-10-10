import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { METHODS } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { clearTimeout, setTimeout } from 'node:timers'
import { setTimeout as delay } from 'node:timers/promises'

export function authenticationConfiguration() {
  const keys = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const privateKeyPem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' })
  const publicKeyPem = keys.publicKey.export({ type: 'spki', format: 'pem' })

  return {
    accessJwt: {
      issuer: 'https://issuer.test.invalid',
      audience: 'runtime-test-api',
      signingKey: {
        kid: 'runtime-test-key',
        privateKeyPem
      },
      verificationKeys: [
        {
          kid: 'runtime-test-key',
          publicKeyPem
        }
      ]
    },
    passkey: {
      apiOrigin: 'https://api.test.invalid',
      rpId: 'api.test.invalid',
      rpName: 'DFragon test',
      returnUrl: 'dfragon.dev://auth/callback'
    }
  }
}

export async function withRuntimeConfiguration(
  operation,
  configuration = authenticationConfiguration()
) {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-runtime-'))
  const path = join(directory, 'auth.json')
  try {
    await writeFile(path, JSON.stringify(configuration), { mode: 0o600 })

    return await operation({ path, configuration })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export function databaseEnvironment(
  configuration = {
    host: '127.0.0.1',
    port: 1,
    username: 'runtime-test',
    password: 'runtime-test-password',
    database: 'runtime-test'
  }
) {
  const host = configuration.host
  const portText = String(configuration.port)
  const username = configuration.username
  const password = configuration.password
  const database = configuration.database

  return {
    DB_HOST: host,
    DB_PORT: portText,
    DB_USERNAME: username,
    DB_PASSWORD: password,
    DB_NAME: database
  }
}

// accounts 기본 entry가 등록한 route template이다. 원문 경로가 route로 남는 회귀는 이 목록에 없어
// 결과 stdout에 그대로 남고, 기존 빈 stdout 검사가 막는다.
const ACCOUNTS_ACCESS_LOG = {
  service: 'accounts',
  routes: [
    '/auth/exchange',
    '/auth/login-requests',
    '/auth/login/authorize',
    '/auth/login/phone',
    '/auth/logout',
    '/auth/passkeys/:action',
    '/auth/passkeys/client.css',
    '/auth/passkeys/client.js',
    '/auth/passkeys/icon.png',
    '/auth/passkeys/manage',
    '/auth/refresh',
    '/docs',
    '/docs/',
    '/docs/LICENSE',
    '/docs/docs/swagger-ui-init.js',
    '/docs/index.html',
    '/docs/openapi.json',
    '/docs/swagger-ui-init.js',
    '/me',
    '/me/nickname',
    '/version'
  ]
}

/**
 * 빌드한 기본 entry를 띄운다. `accessLog`는 stdout에서 검증한 접근 로그로 인정할 service와
 * route template 목록이다. 다른 서버 entry를 띄울 때는 그 서버의 값을 넘긴다.
 */
export function startRuntime(
  environment,
  {
    fault = '',
    realDatabase = false,
    upstreams = {},
    preload = './test-support/runtime-preload.mjs',
    accessLog = ACCOUNTS_ACCESS_LOG
  } = {}
) {
  // 실제 환경의 credential, NODE_OPTIONS를 상속하지 않고 명시한 fixture만 전달한다.
  const env = {
    PATH: process.env.PATH,
    ...environment,
    DFRAGON_TEST_RUNTIME_FAULT: fault,
    DFRAGON_TEST_RUNTIME_DATABASE: realDatabase ? 'real' : 'fake',
    DFRAGON_TEST_NEOPLE_ORIGIN: upstreams.neople ?? ''
  }
  const child = spawn(
    process.execPath,
    ['--import', 'reflect-metadata', '--import', preload, 'dist/main.js'],
    { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] }
  )
  const events = []
  const accessLogs = []
  let stdout = ''
  let stderr = ''
  child.on('message', (message) => events.push(message))
  child.stdout.setEncoding('utf8').on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.setEncoding('utf8').on('data', (chunk) => {
    stderr += chunk
  })
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => {
      // 결과의 stdout은 검증한 접근 로그를 뺀 나머지 출력이다. 빈 값 검사는 그 밖의 출력을 계속 막는다.
      const separated = separateAccessLogs(stdout, accessLog)
      accessLogs.push(...separated.accessLogs)
      resolve({ code, signal, stdout: separated.otherOutput, stderr })
    })
  })

  return { child, events, accessLogs, exited }
}

const ACCESS_LOG_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const ACCESS_LOG_CODE_PATTERN = /^[A-Z][A-Z_]*$/
const ACCESS_LOG_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const ERROR_CHAIN_NAME_PATTERN = /^(?:[A-Za-z_$][\w$]{0,79}|<unnamed>|<non-error>)$/
const ERROR_CHAIN_CODE_PATTERN = /^\w{1,64}$/

/** 5xx의 오류 chain은 이름, 식별자 형식 code, 길이를 제한한 frame만 가진 항목 5개 이하다. */
function isErrorChain(errorChain) {
  const isChainList = Array.isArray(errorChain) && errorChain.length >= 1 && errorChain.length <= 5
  if (!isChainList) {
    return false
  }

  return errorChain.every((item) => {
    const isObject = typeof item === 'object' && item !== null && !Array.isArray(item)
    if (!isObject) {
      return false
    }

    const { name, code, frames, ...rest } = item
    const hasOnlyAllowedFields = Object.keys(rest).length === 0
    const hasName = typeof name === 'string' && ERROR_CHAIN_NAME_PATTERN.test(name)
    const hasCode =
      code === undefined || (typeof code === 'string' && ERROR_CHAIN_CODE_PATTERN.test(code))
    const hasFrames =
      frames === undefined ||
      (Array.isArray(frames) &&
        frames.length <= 5 &&
        frames.every((frame) => typeof frame === 'string' && frame.length <= 300))

    return hasOnlyAllowedFields && hasName && hasCode && hasFrames
  })
}

/** 기본 entry의 접근 로그는 auth-api Rule의 allowlist field와 형식만 가진 JSON 한 줄이어야 한다. */
function parseAccessLog(line, accessLog) {
  let entry
  try {
    entry = JSON.parse(line)
  } catch {
    return undefined
  }
  const isObject = typeof entry === 'object' && entry !== null && !Array.isArray(entry)
  if (!isObject) {
    return undefined
  }

  const {
    time,
    service,
    method,
    route,
    status,
    code,
    errorChain,
    durationMs,
    correlationId,
    aborted,
    ...rest
  } = entry
  const hasOnlyAllowedFields = Object.keys(rest).length === 0
  const hasTime = typeof time === 'string' && ACCESS_LOG_TIME_PATTERN.test(time)
  const hasRoute = route === '<unmatched>' || accessLog.routes.includes(route)
  // Header 전송 전에 끊긴 요청만 status 없이 aborted로 남는다.
  const hasStatus = status === undefined ? aborted === true : Number.isInteger(status)
  const hasCode =
    code === undefined || (typeof code === 'string' && ACCESS_LOG_CODE_PATTERN.test(code))
  // 오류 chain은 5xx 응답에만 붙는다.
  const isServerError = Number.isInteger(status) && status >= 500
  const hasErrorChain = errorChain === undefined || (isServerError && isErrorChain(errorChain))
  const hasDuration = Number.isInteger(durationMs) && durationMs >= 0
  const hasCorrelationId =
    typeof correlationId === 'string' && ACCESS_LOG_ID_PATTERN.test(correlationId)
  const hasAborted = aborted === undefined || aborted === true
  const isAccessLog =
    hasOnlyAllowedFields &&
    hasTime &&
    service === accessLog.service &&
    METHODS.includes(method) &&
    hasRoute &&
    hasStatus &&
    hasCode &&
    hasErrorChain &&
    hasDuration &&
    hasCorrelationId &&
    hasAborted
  if (!isAccessLog) {
    return undefined
  }

  return entry
}

function separateAccessLogs(stdout, accessLog) {
  const outputLinePattern = /[^\n]*\n|[^\n]+$/g
  const accessLogs = []
  let otherOutput = ''
  for (const segment of stdout.match(outputLinePattern) ?? []) {
    const isCompleteLine = segment.endsWith('\n')
    const entry = isCompleteLine ? parseAccessLog(segment.slice(0, -1), accessLog) : undefined
    if (entry === undefined) {
      otherOutput += segment
    } else {
      accessLogs.push(entry)
    }
  }

  return { accessLogs, otherOutput }
}

export async function collectRuntimeExit(runtime, timeoutMs = 5000) {
  let timer
  try {
    return await Promise.race([
      runtime.exited,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          runtime.child.kill('SIGKILL')
          reject(new Error('API did not exit within the test deadline'))
        }, timeoutMs)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

export async function stopRuntime(runtime) {
  const isRunning = runtime.child.exitCode === null && runtime.child.signalCode === null
  if (isRunning) {
    runtime.child.kill('SIGKILL')
  }
  await runtime.exited
}

export async function unusedRuntimePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  await new Promise((resolve, reject) =>
    server.close((error) => {
      const hasError = error != null
      if (hasError) {
        reject(error)
      } else {
        resolve()
      }
    })
  )

  return port
}

export async function waitForRuntime(port, runtime) {
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

export function runtimeEnvironment(path, port, database) {
  const databaseVariables = databaseEnvironment(database)
  const portText = String(port)

  return {
    ...databaseVariables,
    AUTH_CONFIG_FILE: path,
    PORT: portText
  }
}

export function assertStartupFailure(result) {
  assert.equal(result.code, 1)
  assert.equal(result.signal, null)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'Accounts failed to start\n')
}
