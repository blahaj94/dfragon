import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { createDatabaseDataSource } from '../dist/database/index.js'
import { databaseSnapshot, withDataSource } from './database-contract.mjs'
import { assertBackendGone } from './character-search-fixtures.mjs'
import {
  assertStartupFailure,
  collectRuntimeExit,
  runtimeEnvironment,
  startRuntime,
  stopRuntime,
  unusedRuntimePort,
  waitForRuntime,
  withRuntimeConfiguration
} from './runtime-fixtures.mjs'

function backendPids(runtime) {
  return runtime.events.filter(({ event }) => event === 'db.backend').map(({ detail }) => detail)
}

async function assertDisconnected(source, runtime) {
  const pids = backendPids(runtime)
  const hasBackendConnections = pids.length > 0
  assert(hasBackendConnections, 'default entry must acquire an observable database connection')
  for (const pid of pids) {
    await assertBackendGone(source, pid)
  }
  const disconnected = runtime.events.some(({ event }) => event === 'db.disconnected')
  assert(disconnected, 'runtime must explicitly finish database cleanup')
}

async function terminateRuntime(source, runtime, signal = 'SIGTERM') {
  runtime.child.kill(signal)
  const result = await collectRuntimeExit(runtime)
  assert.deepEqual(result, { code: 0, signal: null, stdout: '', stderr: '' })
  await assertDisconnected(source, runtime)
}

export async function assertRuntimeFreshStart(configuration, mark = () => {}) {
  await withDataSource(createDatabaseDataSource, configuration, async (source) => {
    const before = await databaseSnapshot(source)
    assert.deepEqual(before.relations, [])
    await withRuntimeConfiguration(async ({ path }) => {
      const port = await unusedRuntimePort()
      const runtime = startRuntime(runtimeEnvironment(path, port, configuration), {
        realDatabase: true
      })
      try {
        await waitForRuntime(port, runtime)
        mark('fresh database: GET /me without a token returns 401 and startup leaves schema empty')
        const response = await fetch(`http://127.0.0.1:${port}/me`)
        assert.equal(response.status, 401)
        assert.deepEqual(await databaseSnapshot(source), before)
        await terminateRuntime(source, runtime, 'SIGINT')
        assert.deepEqual(await databaseSnapshot(source), before)
      } finally {
        await stopRuntime(runtime)
      }
    })
  })
}

export async function assertRuntimeDatabaseFailures(configuration, mark = () => {}) {
  await withDataSource(createDatabaseDataSource, configuration, async (source) => {
    const before = await databaseSnapshot(source)
    for (const fault of [
      'partial-connect',
      'app-create',
      'nest-provider',
      'app-configure',
      'listen'
    ]) {
      mark(`${fault}: startup fails safely and its PostgreSQL backend disappears`)
      const server = createServer()
      const hasOccupiedPort = fault === 'listen'
      if (hasOccupiedPort) {
        await new Promise((resolve) => server.listen(0, resolve))
      }
      try {
        await withRuntimeConfiguration(async ({ path }) => {
          const port = hasOccupiedPort ? server.address().port : await unusedRuntimePort()
          const runtime = startRuntime(runtimeEnvironment(path, port, configuration), {
            realDatabase: true,
            fault
          })
          try {
            assertStartupFailure(await collectRuntimeExit(runtime))
            await assertDisconnected(source, runtime)
            assert.deepEqual(await databaseSnapshot(source), before)
          } finally {
            await stopRuntime(runtime)
          }
        })
      } finally {
        if (hasOccupiedPort) {
          await new Promise((resolve) => server.close(resolve))
        }
      }
    }
  })
}

export async function assertRuntimeHttpIntegration(configuration, mark = () => {}) {
  await withDataSource(createDatabaseDataSource, configuration, async (source) => {
    await withRuntimeConfiguration(async ({ path }) => {
      const port = await unusedRuntimePort()
      const runtime = startRuntime(runtimeEnvironment(path, port, configuration), {
        realDatabase: true
      })
      try {
        await waitForRuntime(port, runtime)
        mark('default entry exposes passkeys and removes OAuth callbacks')
        for (const provider of ['google', 'discord']) {
          assert.equal(
            (await fetch(`http://127.0.0.1:${port}/auth/callback/${provider}`)).status,
            404
          )
        }
        const response = await fetch(`http://127.0.0.1:${port}/auth/passkeys/manage`)
        assert.equal(response.status, 200)
        const html = await response.text()
        assert.match(html, /data-purpose="manage"/)
        assert.match(html, /src="\/auth\/passkeys\/client.js"/)
        assert.match(response.headers.get('set-cookie'), /Secure; HttpOnly/)
        await terminateRuntime(source, runtime)
      } finally {
        await stopRuntime(runtime)
      }
    })
  })
  return 1
}
