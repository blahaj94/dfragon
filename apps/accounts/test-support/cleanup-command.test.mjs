import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { test } from 'node:test'
import { URL } from 'node:url'
import { bounded } from './login-test-control.mjs'

const load = () => import('../dist/auth/cleanup/command.js')

for (const [name, stage] of [
  ['성공', 'success'],
  ['DataSource 생성 실패', 'factory'],
  ['initialize 실패', 'initialize'],
  ['cleanup 실패', 'cleanup'],
  ['destroy 실패', 'destroy'],
  ['부분 initialize 실패', 'partial initialize'],
  ['부분 disconnect 실패', 'partial disconnect']
]) {
  test(`cleanup command는 연결을 소유하고 종료한다: ${name}`, async () => {
    const { runAuthenticationCleanup } = await load()
    const calls = []
    const fail = () => {
      throw new Error('fixture-private SQL detail')
    }
    const source = {
      isInitialized: false,
      initialize: async () => {
        calls.push('initialize')
        const hasPartialFailure = stage === 'partial initialize' || stage === 'partial disconnect'
        const hasInitializeFailure = stage === 'initialize'
        const hasInitializationFailure = hasPartialFailure || hasInitializeFailure
        if (hasInitializationFailure) {
          fail()
        }
        source.isInitialized = true
      },
      query: async () => {
        const shouldFail = stage === 'cleanup'
        if (shouldFail) {
          fail()
        }

        return []
      },
      destroy: async () => {
        calls.push('destroy')
        const shouldFail = stage === 'destroy'
        if (shouldFail) {
          fail()
        }
        source.isInitialized = false
      },
      driver: {
        disconnect: async () => {
          calls.push('disconnect')
          const shouldFail = stage === 'partial disconnect'
          if (shouldFail) {
            fail()
          }
        }
      }
    }
    const run = runAuthenticationCleanup(() => {
      calls.push('factory')
      const shouldFail = stage === 'factory'
      if (shouldFail) {
        fail()
      }

      return source
    })
    const isSuccess = stage === 'success'
    if (isSuccess) {
      assert.deepEqual(await run, { sessionsDeleted: 0, loginRequestsDeleted: 0 })
    } else {
      await assert.rejects(run, (error) => {
        assert.equal(error.message, 'Authentication cleanup failed')
        assert.equal(error.stack, 'Error: Authentication cleanup failed')
        assert.equal(error.cause, undefined)

        return true
      })
    }
    const failedBeforeSource = stage === 'factory'
    const failedBeforeInitialized =
      stage === 'initialize' || stage === 'partial initialize' || stage === 'partial disconnect'
    if (failedBeforeSource) {
      assert.deepEqual(calls, ['factory'])
    } else if (failedBeforeInitialized) {
      assert.deepEqual(calls, ['factory', 'initialize', 'disconnect'])
    } else {
      assert.deepEqual(calls, ['factory', 'initialize', 'destroy'])
    }
  })
}

test('cleanup command는 소유 연결의 종료가 끝나야 성공한다', async () => {
  const { runAuthenticationCleanup } = await load()
  const closing = Promise.withResolvers()
  const release = Promise.withResolvers()
  const source = {
    isInitialized: true,
    initialize: async () => undefined,
    query: async () => [],
    destroy: async () => {
      closing.resolve()
      await release.promise
    }
  }
  let returned = false
  const pending = runAuthenticationCleanup(() => source).then((result) => {
    returned = true

    return result
  })
  try {
    await bounded(closing.promise)
    assert.equal(returned, false)
  } finally {
    release.resolve()
  }
  assert.deepEqual(await pending, { sessionsDeleted: 0, loginRequestsDeleted: 0 })
})

test('cleanup CLI의 DB 설정 누락은 값, stack 없는 실패로 종료한다', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'reflect-metadata', 'dist/auth/cleanup/cli.js'],
    {
      cwd: new URL('..', import.meta.url),
      env: {},
      encoding: 'utf8',
      timeout: 5000
    }
  )
  assert.equal(result.status, 1)
  assert.equal(result.signal, null)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'Authentication cleanup failed\n')
})

test('cleanup script는 기존 ESM build를 사용한다', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(
    manifest.scripts['auth:cleanup'],
    'pnpm run build && node --import reflect-metadata dist/auth/cleanup/cli.js'
  )
})
