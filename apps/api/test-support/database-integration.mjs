import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { createDatabaseDataSource } from '../dist/database/index.js'
import {
  verifyApprovedImage,
  newRunId,
  createPostgres,
  teardownPostgres,
  assertResourcesAbsent
} from './docker-postgres.mjs'
import { assertCharacterDetails } from './character-details.mjs'
import { assertCharacterCatalog } from './character-catalog.mjs'
import { assertAdventureSearch } from './adventure-search.mjs'
import { assertCharacterSearchHttpIntegration } from './character-search-http-integration.mjs'

let resources, source
const id = newRunId('apidatabase')
let stage = 'image verification'
try {
  const image = await verifyApprovedImage()
  process.stdout.write(`Disposable API database recovery: ${id}\n`)
  resources = await createPostgres(id, image)
  stage = 'database readiness'
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
  stage = 'domain-only schema and idempotent migrations'
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
  for (const [name, test] of [
    ['details', assertCharacterDetails],
    ['catalog', assertCharacterCatalog],
    ['adventures', assertAdventureSearch],
    ['public search', assertCharacterSearchHttpIntegration]
  ]) {
    await test(source, (part) => {
      stage = `${name}: ${part}`
    })
    process.stdout.write(`API ${name}: passed\n`)
  }
  stage = 'empty disposable rollback'
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
  process.stdout.write('API domain database separation: passed\n')
} catch {
  process.stderr.write(`API database verification failed at ${stage}\n`)
  process.exitCode = 1
} finally {
  if (source?.isInitialized) {
    await source.destroy()
  }

  if (resources) {
    await teardownPostgres(resources)
  }
  await assertResourcesAbsent(id)
}
