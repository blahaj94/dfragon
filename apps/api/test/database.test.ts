import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { Migration } from 'typeorm'
import {
  createDatabaseDataSource,
  createDatabaseOptions,
  readDatabaseConfiguration,
  runMigrationCommand
} from '../src/database/index.js'
import { generateMigration } from '../src/database/generate.js'

const environment = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '5432',
  DB_USERNAME: 'synthetic',
  DB_PASSWORD: 'synthetic',
  DB_NAME: 'synthetic'
}

// 이 fake는 CLI orchestration·오류 정제만 검증한다. SQL·잠금은 test:database에서 확인한다.
function migrationSource(t: TestContext) {
  const source = createDatabaseDataSource(readDatabaseConfiguration(environment))
  let initialized = false
  Object.defineProperty(source, 'isInitialized', { get: () => initialized })
  const initialize = t.mock.method(source, 'initialize', async () => {
    initialized = true

    return source
  })
  const destroy = t.mock.method(source, 'destroy', async () => {
    initialized = false
  })

  return { source, initialize, destroy }
}

function assertSanitized(error: unknown, message: string): boolean {
  assert(error instanceof Error)
  assert.equal(error.message, message)
  assert.equal(error.stack, `Error: ${message}`)
  assert.equal(error.cause, undefined)

  return true
}

test('DB 설정은 필수 값·십진 포트를 검사하고 runtime 자동 schema 변경을 끈다', async (t) => {
  const configuration = readDatabaseConfiguration(environment)
  assert.deepEqual(configuration, {
    host: '127.0.0.1',
    port: 5432,
    username: 'synthetic',
    password: 'synthetic',
    database: 'synthetic'
  })
  const options = createDatabaseOptions(configuration)
  assert.equal(options.synchronize, false)
  assert.equal(options.migrationsRun, false)
  assert.equal(options.logging, false)
  assert.equal(options.migrationsTransactionMode, 'all')
  for (const name of ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME']) {
    await t.test(`${name} 누락·빈 값`, () => {
      for (const value of [undefined, '']) {
        assert.throws(() => readDatabaseConfiguration({ ...environment, [name]: value }), {
          message: 'Invalid database configuration'
        })
      }
    })
  }
  for (const port of ['0', '65536', '1.5', '+1', ' 1', '1\n', '1e3', '0x10', '١', '9'.repeat(30)]) {
    assert.throws(() => readDatabaseConfiguration({ ...environment, DB_PORT: port }), {
      message: 'Invalid database configuration'
    })
  }
  assert.equal(readDatabaseConfiguration({ ...environment, DB_PORT: '00001' }).port, 1)
  assert.equal(readDatabaseConfiguration({ ...environment, DB_PORT: '65535' }).port, 65_535)
})

test('migration up·down은 전체 transaction을 요청하고 성공 뒤 소유 연결을 정리한다', async (t) => {
  for (const command of ['up', 'down'] as const) {
    await t.test(command === 'up' ? 'up 적용' : 'down 되돌리기', async (t) => {
      const { source, destroy } = migrationSource(t)
      const apply = t.mock.method(source, 'runMigrations', async () => [
        new Migration(undefined, 1, 'SyntheticMigration')
      ])
      const revert = t.mock.method(source, 'undoLastMigration', async () => undefined)
      const expected =
        command === 'up' ? 'Database migration applied: 1' : 'Database migration reverted'
      assert.equal(await runMigrationCommand(command, () => source), expected)
      const operation = command === 'up' ? apply : revert
      assert.deepEqual(
        operation.mock.calls.map(({ arguments: args }) => args),
        [[{ transaction: 'all' }]]
      )
      assert.equal(source.isInitialized, false)
      assert.equal(destroy.mock.callCount(), 1)
    })
  }
})

test('migration show는 읽기만 수행하고 등록된 migration의 적용 여부를 비교한다', async (t) => {
  for (const { name, exists, history, expected } of [
    { name: '빈 DB', exists: false, history: [], expected: 'pending' },
    { name: '일부 적용', exists: true, history: [{ name: 'First' }], expected: 'pending' },
    {
      name: '전체 적용',
      exists: true,
      history: [{ name: 'First' }, { name: 'Second' }],
      expected: 'current'
    }
  ]) {
    await t.test(name, async (t) => {
      const { source, destroy } = migrationSource(t)
      source.migrations.push(
        ...['First', 'Second'].map((name) => ({
          name,
          up: async () => undefined,
          down: async () => undefined
        }))
      )
      t.mock.method(source, 'query', async (sql: string) => {
        if (sql === "SELECT to_regclass('public.typeorm_migrations') IS NOT NULL AS exists") {
          return [{ exists }]
        }

        if (exists && sql === 'SELECT name FROM "typeorm_migrations"') {
          return history
        }
        assert.fail('show는 schema나 history를 쓰지 않고 필요한 SELECT만 실행해야 한다')
      })
      assert.equal(
        await runMigrationCommand('show', () => source),
        `Database migrations ${expected}`
      )
      assert.equal(destroy.mock.callCount(), 1)
    })
  }
})

test('migration factory·연결·실행·정리 실패는 비밀 원문 없이 실패하고 열린 연결을 정리한다', async (t) => {
  for (const stage of ['factory', 'initialize', 'up', 'down', 'show', 'destroy'] as const) {
    await t.test(`${stage} 실패`, async (t) => {
      const { source, initialize, destroy } = migrationSource(t)
      const fail = async (): Promise<never> => {
        throw new Error('synthetic-private-database-error')
      }
      if (stage === 'initialize') {
        initialize.mock.mockImplementation(fail)
      }

      if (stage === 'destroy') {
        destroy.mock.mockImplementation(fail)
      }
      t.mock.method(source, 'runMigrations', stage === 'up' ? fail : async () => [])
      t.mock.method(source, 'undoLastMigration', stage === 'down' ? fail : async () => undefined)
      t.mock.method(source, 'query', stage === 'show' ? fail : async () => [{ exists: false }])
      const command = stage === 'down' || stage === 'show' ? stage : 'up'
      await assert.rejects(
        runMigrationCommand(command, () => {
          if (stage === 'factory') {
            throw new Error('synthetic-private-factory-error')
          }

          return source
        }),
        (error: unknown) => assertSanitized(error, 'Database migration failed')
      )
      if (stage !== 'factory' && stage !== 'initialize') {
        assert.equal(destroy.mock.callCount(), 1)
      }
    })
  }
})

test('migration generator는 잘못된 이름에서 연결하지 않고 schema 차이가 없으면 파일을 만들지 않는다', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'api-migration-generator-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const { source, initialize, destroy } = migrationSource(t)
  for (const name of ['', 'lowercase', '../Escape', 'A'.repeat(81)]) {
    await assert.rejects(
      generateMigration(name, () => source, directory),
      (error: unknown) => assertSanitized(error, 'Database migration generation failed')
    )
  }
  assert.equal(initialize.mock.callCount(), 0)
  t.mock.method(source.driver, 'createSchemaBuilder', () => ({
    build: async () => {
      assert.fail('generator는 schema를 변경하면 안 된다')
    },
    log: async () => ({ upQueries: [], downQueries: [] })
  }))
  assert.equal(
    await generateMigration('NoChanges', () => source, directory),
    'Database schema is current'
  )
  assert.deepEqual(await readdir(directory), [])
  assert.equal(destroy.mock.callCount(), 1)
})

test('migration generator는 schema 조회 실패를 정제하고 기존 생성 파일을 덮어쓰지 않는다', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'api-migration-collision-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const timestamp = 1_800_000_000_000
  t.mock.method(Date, 'now', () => timestamp)
  const path = join(directory, `${timestamp}-KeepExisting.ts`)
  await writeFile(path, '기존 migration 원문')
  const { source, destroy } = migrationSource(t)
  let failSchemaRead = true
  t.mock.method(source.driver, 'createSchemaBuilder', () => ({
    build: async () => {
      assert.fail('generator는 schema를 변경하면 안 된다')
    },
    log: async () => {
      if (failSchemaRead) {
        throw new Error('synthetic-private-schema-error')
      }

      return { upQueries: [{ query: 'SELECT 1' }], downQueries: [] }
    }
  }))
  await assert.rejects(
    generateMigration('KeepExisting', () => source, directory),
    (error: unknown) => assertSanitized(error, 'Database migration generation failed')
  )
  assert.equal(destroy.mock.callCount(), 1)
  failSchemaRead = false
  await assert.rejects(
    generateMigration('KeepExisting', () => source, directory),
    (error: unknown) => assertSanitized(error, 'Database migration generation failed')
  )
  assert.equal(destroy.mock.callCount(), 2)
  assert.equal(await readFile(path, 'utf8'), '기존 migration 원문')
})
