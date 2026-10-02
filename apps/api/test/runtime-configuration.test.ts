import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readRuntimeConfiguration } from '../src/runtime/configuration.js'

const environment = {
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: 'synthetic',
  DB_USERNAME: 'synthetic',
  DB_PASSWORD: 'synthetic',
  NEOPLE_API_KEY: 'synthetic'
}

test('API runtime 설정은 인증 secret 없이 읽고 이전 인증 입력을 무시한다', async () => {
  const baseline = await readRuntimeConfiguration(environment)
  assert.deepEqual(baseline, {
    port: 3000,
    database: {
      host: 'localhost',
      port: 5432,
      database: 'synthetic',
      username: 'synthetic',
      password: 'synthetic'
    },
    apiKey: 'synthetic',
    trustedProxyHops: undefined,
    localHttps: undefined
  })
  assert.deepEqual(
    await readRuntimeConfiguration({ ...environment, AUTH_CONFIG_FILE: '/missing/auth.json' }),
    baseline
  )
  assert.equal(Object.hasOwn(baseline, 'issueAccessJwt'), false)
  await assert.rejects(
    readRuntimeConfiguration({ ...environment, NEOPLE_API_KEY: '' }),
    /Invalid API runtime configuration/
  )
})

test('runtime secret 파일은 원문을 유지하며 모호하거나 읽을 수 없는 입력을 거절한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'api-secret-input-'))
  try {
    const file = join(directory, 'secret')
    await writeFile(file, '\uFEFFsynthetic-file-secret \r\n\n')
    for (const name of ['DB_PASSWORD', 'NEOPLE_API_KEY']) {
      const fileName = `${name}_FILE`
      const configuration = await readRuntimeConfiguration({
        ...environment,
        [name]: undefined,
        [fileName]: file
      })
      assert.equal(
        name === 'DB_PASSWORD' ? configuration.database.password : configuration.apiKey,
        '\uFEFFsynthetic-file-secret \r'
      )
      for (const candidate of [
        { [name]: 'synthetic-secret', [fileName]: file },
        { [name]: '', [fileName]: file },
        { [name]: '' },
        { [name]: undefined, [fileName]: '' },
        { [name]: undefined, [fileName]: 'relative-secret-path' },
        { [name]: undefined, [fileName]: `${file}.missing` },
        { [name]: undefined, [fileName]: directory }
      ]) {
        await assert.rejects(
          readRuntimeConfiguration({ ...environment, ...candidate }),
          new Error('Invalid API runtime configuration')
        )
      }
    }
    for (const name of ['DB_PASSWORD', 'NEOPLE_API_KEY']) {
      for (const contents of ['', ' \n', Buffer.from([0xff])]) {
        await writeFile(file, contents)
        await assert.rejects(
          readRuntimeConfiguration({
            ...environment,
            [name]: undefined,
            [`${name}_FILE`]: file
          }),
          new Error('Invalid API runtime configuration')
        )
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('runtime 필수 설정과 프록시 모드 오류는 secret과 원인 없이 정제한다', async (t) => {
  const cases = [
    { name: 'PORT 누락', change: { PORT: undefined } },
    { name: 'PORT 빈 값', change: { PORT: '' } },
    { name: 'PORT 범위 초과', change: { PORT: '65536' } },
    { name: 'DB 입력 누락', change: { DB_HOST: undefined } },
    { name: 'DB 포트 비십진', change: { DB_PORT: '5.432' } },
    { name: 'Neople key 누락', change: { NEOPLE_API_KEY: undefined } },
    { name: 'Neople key 공백', change: { NEOPLE_API_KEY: ' \n' } },
    { name: '프록시 모드 빈 값', change: { SEARCH_TRUST_PROXY: '' } },
    { name: '프록시 모드 오타', change: { SEARCH_TRUST_PROXY: 'single-hop-private-marker' } },
    { name: '프록시 hop 숫자', change: { SEARCH_TRUST_PROXY: '2' } }
  ]
  for (const { name, change } of cases) {
    await t.test(name, async () => {
      await assert.rejects(
        readRuntimeConfiguration({
          ...environment,
          DB_PASSWORD: 'database-private-marker',
          NEOPLE_API_KEY: 'neople-private-marker',
          ...change
        }),
        (error: unknown) => {
          assert(error instanceof Error)
          assert.equal(error.message, 'Invalid API runtime configuration')
          assert.equal(error.cause, undefined)
          assert.doesNotMatch(error.stack ?? '', /private-marker/)

          return true
        }
      )
    })
  }
  assert.equal(
    (await readRuntimeConfiguration({ ...environment, SEARCH_TRUST_PROXY: 'single-hop' }))
      .trustedProxyHops,
    1
  )
})

test('로컬 HTTPS는 두 절대 파일 경로·일치하는 loopback origin·유효한 PEM을 요구한다', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'api-local-https-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const cert = join(directory, 'private-marker-cert.pem')
  const key = join(directory, 'private-marker-key.pem')
  await writeFile(cert, 'private-marker-invalid-certificate')
  await writeFile(key, 'private-marker-invalid-key')
  const cases = [
    { name: '인증서만 제공', files: { LOCAL_HTTPS_CERT_FILE: cert } },
    { name: '키만 제공', files: { LOCAL_HTTPS_KEY_FILE: key } },
    {
      name: '상대 인증서 경로',
      files: { LOCAL_HTTPS_CERT_FILE: 'cert.pem', LOCAL_HTTPS_KEY_FILE: key }
    },
    {
      name: '상대 키 경로',
      files: { LOCAL_HTTPS_CERT_FILE: cert, LOCAL_HTTPS_KEY_FILE: 'key.pem' }
    },
    {
      name: '읽을 수 없는 파일',
      files: { LOCAL_HTTPS_CERT_FILE: cert + '.missing', LOCAL_HTTPS_KEY_FILE: key }
    },
    {
      name: '외부 origin',
      files: {
        LOCAL_HTTPS_CERT_FILE: cert,
        LOCAL_HTTPS_KEY_FILE: key,
        API_ORIGIN: 'https://example.invalid:3000'
      }
    },
    {
      name: '다른 포트의 origin',
      files: {
        LOCAL_HTTPS_CERT_FILE: cert,
        LOCAL_HTTPS_KEY_FILE: key,
        API_ORIGIN: 'https://localhost:3443'
      }
    },
    { name: '잘못된 PEM', files: { LOCAL_HTTPS_CERT_FILE: cert, LOCAL_HTTPS_KEY_FILE: key } }
  ]
  for (const { name, files } of cases) {
    await t.test(name, async () => {
      await assert.rejects(
        readRuntimeConfiguration({
          ...environment,
          API_ORIGIN: 'https://localhost:3000',
          ...files
        }),
        (error: unknown) => {
          assert(error instanceof Error)
          assert.equal(error.message, 'Invalid API runtime configuration')
          assert.equal(error.cause, undefined)
          assert.doesNotMatch(error.stack ?? '', /private-marker|ENOENT|PEM routines/)

          return true
        }
      )
    })
  }
})
