import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { createDatabaseDataSource, runMigrationCommand } from '../dist/database/index.js'
import {
  verifyApprovedImage,
  newRunId,
  createPostgres,
  teardownPostgres,
  assertResourcesAbsent
} from '../../../scripts/test-support/docker-postgres.mjs'
import { createApiRuntime } from '../dist/runtime/application.js'
import { assertCharacterDetails } from './character-details.mjs'
import { assertCharacterCatalog } from './character-catalog.mjs'
import { assertAdventureSearch } from './adventure-search.mjs'
import { assertCharacterSearchHttpIntegration } from './character-search-http-integration.mjs'

// 한 단계의 정리 실패가 나머지 소유 자원의 정리를 건너뛰지 않게 한다.
export async function cleanupDatabaseIntegration({
  source,
  resources,
  id,
  teardown = teardownPostgres,
  assertAbsent = assertResourcesAbsent
}) {
  let failed = false
  const operations = [
    async () => {
      if (source?.isInitialized) {
        await source.destroy()
      }
    },
    async () => {
      if (resources) {
        await teardown(resources)
      }
    },
    () => assertAbsent(id)
  ]
  for (const operation of operations) {
    try {
      await operation()
    } catch {
      failed = true
    }
  }
  if (failed) {
    throw new Error('API database test resource cleanup failed')
  }
}

async function main() {
  let resources, source
  const id = newRunId('apidatabase')
  let stage = '이미지 검증'
  try {
    const image = await verifyApprovedImage()
    process.stdout.write(`임시 API DB 정리 식별자: ${id}\n`)
    resources = await createPostgres(id, image)
    stage = 'DB 연결 준비'
    for (let attempt = 0; attempt < 100; attempt++) {
      source = createDatabaseDataSource(resources.configuration)
      try {
        await source.initialize()
        break
      } catch {
        await delay(150)
      }
    }
    assert(source.isInitialized)
    stage = '빈 DB migration show는 schema를 생성하지 않는다'
    const publicTables = async () =>
      (
        await source.query(
          "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
        )
      ).map((row) => row.tablename)
    assert.deepEqual(await publicTables(), [])
    assert.equal(
      await runMigrationCommand('show', () => createDatabaseDataSource(resources.configuration)),
      'Database migrations pending'
    )
    assert.deepEqual(await publicTables(), [])
    stage = 'domain 전용 schema와 migration 반복 적용'
    assert.equal((await source.runMigrations({ transaction: 'all' })).length, 4)
    assert.equal((await source.runMigrations({ transaction: 'all' })).length, 0)
    assert.deepEqual(
      (
        await source.query(
          "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
        )
      ).map((row) => row.tablename),
      [
        'character_api_responses',
        'characters',
        'item_catalog',
        'set_item_catalog',
        'skill_catalog',
        'typeorm_migrations'
      ]
    )
    assert.equal((await source.driver.createSchemaBuilder().log()).upQueries.length, 0)
    assert.equal(
      await runMigrationCommand('show', () => createDatabaseDataSource(resources.configuration)),
      'Database migrations current'
    )
    stage = '실제 DB runtime factory의 listen·반복 종료·연결 정리'
    const connectionCount = async () =>
      (
        await source.query(
          'SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()'
        )
      )[0].count
    const connectionsBefore = await connectionCount()
    const runtime = await createApiRuntime({
      port: 3000,
      database: resources.configuration,
      apiKey: 'synthetic-runtime-key',
      trustedProxyHops: undefined,
      localHttps: undefined
    })
    const server = runtime.app.getHttpServer()
    try {
      assert.equal(server.listening, false)
      await runtime.app.listen(0, '127.0.0.1')
      const response = await fetch(`${await runtime.app.getUrl()}/health`, {
        signal: AbortSignal.timeout(2000)
      })
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { status: 'ok' })
    } finally {
      await Promise.all([runtime.close(), runtime.close()])
    }
    await runtime.close()
    assert.equal(server.listening, false)
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await connectionCount()) === connectionsBefore) {
        break
      }
      await delay(10)
    }
    assert.equal(await connectionCount(), connectionsBefore)
    for (const [name, test] of [
      ['캐릭터 상세', assertCharacterDetails],
      ['공용 상세', assertCharacterCatalog],
      ['모험단 검색', assertAdventureSearch],
      ['공개 검색', assertCharacterSearchHttpIntegration]
    ]) {
      await test(source, (part) => {
        stage = `${name}: ${part}`
      })
      process.stdout.write(`API ${name}: 통과\n`)
    }
    stage = '임시 DB의 전체 migration 되돌리기'
    for (let i = 0; i < 4; i++) {
      await source.undoLastMigration({ transaction: 'all' })
    }
    assert.deepEqual(
      (
        await source.query(
          "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
        )
      ).map((row) => row.tablename),
      ['typeorm_migrations']
    )
    process.stdout.write('API domain DB 분리 검증: 통과\n')
  } catch {
    process.stderr.write(`API DB 검증 실패: ${stage}\n`)
    process.exitCode = 1
  } finally {
    try {
      await cleanupDatabaseIntegration({ source, resources, id })
    } catch {
      process.stderr.write('API DB 검증 자원 정리 실패\n')
      process.exitCode = 1
    }
  }
}

if (import.meta.main) {
  await main()
}
