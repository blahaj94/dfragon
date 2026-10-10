import '../../../api/node_modules/reflect-metadata/Reflect.js'
import assert from 'node:assert/strict'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createDatabaseDataSource } from '../../../api/dist/database/index.js'
import {
  assertResourcesAbsent,
  createPostgres,
  newRunId,
  teardownPostgres,
  verifyApprovedImage
} from '../../../../scripts/test-support/docker-postgres.mjs'
import { waitForAuthenticatedReadiness } from '../../../accounts/test-support/database-contract.mjs'
import { isolatedNeople } from '../../../api/test-support/character-search-fixtures.mjs'
import {
  collectRuntimeExit,
  databaseEnvironment,
  startRuntime,
  stopRuntime,
  unusedRuntimePort,
  waitForRuntime
} from '../../../accounts/test-support/runtime-fixtures.mjs'

const apiDirectory = fileURLToPath(new URL('../../../api/', import.meta.url))
// 이 검사가 부르는 API route template이다. 준비 확인의 `/` 요청은 `<unmatched>`로 남는다.
const searchRoute = '/characters'
const searchAccessLog = { service: 'api', routes: [searchRoute] }

function startApi(environment, upstreams) {
  const originalDirectory = process.cwd()
  try {
    // 기존 helper의 상대 entry만 API checkout에서 resolve한다. 전용 forks process에서 동기 복원한다.
    process.chdir(apiDirectory)

    return startRuntime(environment, {
      realDatabase: true,
      upstreams,
      preload: fileURLToPath(
        new URL('../../../accounts/test-support/runtime-preload.mjs', import.meta.url)
      ),
      accessLog: searchAccessLog
    })
  } finally {
    process.chdir(originalDirectory)
  }
}

async function withApi({ source, database, neople }, operation) {
  const port = await unusedRuntimePort()
  const runtime = startApi(
    {
      ...databaseEnvironment(database),
      PORT: String(port),
      NEOPLE_API_KEY: 'synthetic-search-key'
    },
    {
      neople: neople.origin
    }
  )
  try {
    await waitForRuntime(port, runtime)
    const base = `http://127.0.0.1:${port}`
    const [{ relation: before }] = await source.query(
      "SELECT to_regclass('public.auth_sessions') AS relation"
    )
    assert.equal(before, null, 'public API must not contain Accounts session tables')
    await operation({ base, neople })
    const [{ relation: after }] = await source.query(
      "SELECT to_regclass('public.auth_sessions') AS relation"
    )
    assert.equal(after, null, 'public search must not create Accounts session tables')
  } finally {
    try {
      runtime.child.kill('SIGTERM')
      const result = await collectRuntimeExit(runtime)
      assert.equal(result.code, 0, 'API must exit cleanly')
      assert.equal(result.signal, null)
      const hasNoStdout = result.stdout.length === 0
      const hasNoStderr = result.stderr.length === 0
      const hasNoRuntimeOutput = hasNoStdout && hasNoStderr
      assert(hasNoRuntimeOutput, 'API must not log raw fixture data')
      const hasSearchAccessLog = runtime.accessLogs.some(({ route }) => route === searchRoute)
      assert(hasSearchAccessLog, 'API must write an allowlisted access log for public search')
      const events = runtime.events.map(({ event }) => event)
      const hasDisconnectedDatabase = events.includes('db.disconnected')
      assert(hasDisconnectedDatabase, 'API must disconnect its real database')
      const hasClosedApplication = events.includes('app.closed')
      assert(hasClosedApplication, 'API must close its HTTP application')
    } finally {
      await stopRuntime(runtime)
    }
  }
}

/**
 * @param {(context: {
 *   base: string,
 *   neople: Omit<Awaited<ReturnType<typeof isolatedNeople>>, 'upstream'> & { upstream: { body: unknown } }
 * }) => Promise<void>} operation
 */
export async function withSearchServer(operation) {
  const runId = newRunId('desktopsearch')
  const image = await verifyApprovedImage()
  const resources = await createPostgres(runId, image)
  let source
  let neople
  try {
    source = createDatabaseDataSource(resources.configuration)
    await waitForAuthenticatedReadiness(createDatabaseDataSource, resources.configuration)
    await source.initialize()
    await source.runMigrations({ transaction: 'all' })
    neople = await isolatedNeople()
    await withApi({ source, database: resources.configuration, neople }, operation)
    assert.equal(neople.upstream.failure, undefined)
  } finally {
    const cleanup = [
      async () => {
        const hasNeople = neople != null
        if (hasNeople) {
          await neople.close()
        }
      },
      async () => {
        const hasSource = source != null
        if (hasSource) {
          const hasInitializedSource = source.isInitialized
          if (hasInitializedSource) {
            await source.destroy()
          }
        }
      },
      async () => {
        await teardownPostgres(resources)
        await assertResourcesAbsent(runId)
      }
    ]
    await closeOwnedResources(cleanup)
  }
}

async function closeOwnedResources(cleanup) {
  const errors = []
  for (const close of cleanup) {
    try {
      await close()
    } catch {
      errors.push(new Error('Owned search integration resource cleanup failed'))
    }
  }
  const hasCleanupErrors = errors.length > 0
  if (hasCleanupErrors) {
    throw new AggregateError(errors, 'Search integration cleanup failed')
  }
}
