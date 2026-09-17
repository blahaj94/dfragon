import { readFile } from 'node:fs/promises'
import { randomUUID, randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { setTimeout as delay } from 'node:timers/promises'

export const DOMAIN_TABLES = [
  'auth_login_requests',
  'auth_passkeys',
  'auth_refresh_tokens',
  'auth_sessions',
  'character_api_responses',
  'characters',
  'item_catalog',
  'set_item_catalog',
  'skill_catalog',
  'users'
]
export const MIGRATIONS_TABLE = 'typeorm_migrations'

export async function withDataSource(createDataSource, configuration, operation) {
  const dataSource = createDataSource(configuration)
  try {
    await dataSource.initialize()
    return await operation(dataSource)
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy()
    }
  }
}

export async function waitForAuthenticatedReadiness(
  createDataSource,
  configuration,
  timeoutMs = 20_000
) {
  const deadline = Date.now() + timeoutMs
  while (true) {
    const isBeforeDeadline = Date.now() < deadline
    if (!isBeforeDeadline) {
      break
    }
    const attemptTimeoutMs = Math.max(1, Math.min(500, deadline - Date.now()))
    try {
      return await withDataSource(
        (candidate) => createDataSource(candidate, attemptTimeoutMs),
        configuration,
        async (dataSource) => {
          const result = await dataSource.query('SELECT 1 AS ready')
          assert.equal(result[0].ready, 1)
          return true
        }
      )
    } catch {
      const remainingMs = deadline - Date.now()
      const hasTimeRemaining = remainingMs > 0
      if (hasTimeRemaining) {
        await delay(Math.min(125, remainingMs))
      }
    }
  }
  throw new Error('PostgreSQL readiness timed out')
}

export async function databaseSnapshot(dataSource) {
  const relationsSql = `
      SELECT c.relname AS name, c.relkind AS kind
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname
    `
  const columnsSql = `
      SELECT table_name, ordinal_position, column_name, data_type, udt_name,
             is_nullable, collation_name, datetime_precision
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `
  const constraintsSql = `
      SELECT c.relname AS table_name, con.conname AS constraint_name,
             CASE con.contype
               WHEN 'p' THEN 'PRIMARY KEY'
               WHEN 'u' THEN 'UNIQUE'
               WHEN 'f' THEN 'FOREIGN KEY'
               WHEN 'c' THEN 'CHECK'
             END AS constraint_type
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND con.contype IN ('p', 'u', 'f', 'c')
      ORDER BY c.relname, con.conname
    `
  const indexesSql = `
      SELECT table_class.relname AS table_name, index_class.relname AS index_name,
             (
               SELECT json_agg(attribute.attname ORDER BY key.ordinality)
               FROM unnest(index_info.indkey) WITH ORDINALITY AS key(attnum, ordinality)
               JOIN pg_catalog.pg_attribute attribute
                 ON attribute.attrelid = table_class.oid AND attribute.attnum = key.attnum
             ) AS columns,
             index_info.indisunique AS is_unique,
             pg_catalog.pg_get_expr(index_info.indpred, index_info.indrelid) AS predicate
      FROM pg_catalog.pg_index index_info
      JOIN pg_catalog.pg_class table_class ON table_class.oid = index_info.indrelid
      JOIN pg_catalog.pg_class index_class ON index_class.oid = index_info.indexrelid
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid = table_class.relnamespace
      WHERE namespace.nspname = 'public'
      ORDER BY table_class.relname, index_class.relname
    `
  const foreignKeysSql = `
      SELECT source.relname AS source_table, constraint_info.conname AS constraint_name,
             (
               SELECT json_agg(attribute.attname ORDER BY key.ordinality)
               FROM unnest(constraint_info.conkey) WITH ORDINALITY AS key(attnum, ordinality)
               JOIN pg_catalog.pg_attribute attribute
                 ON attribute.attrelid = source.oid AND attribute.attnum = key.attnum
             ) AS source_columns,
             target.relname AS target_table,
             (
               SELECT json_agg(attribute.attname ORDER BY key.ordinality)
               FROM unnest(constraint_info.confkey) WITH ORDINALITY AS key(attnum, ordinality)
               JOIN pg_catalog.pg_attribute attribute
                 ON attribute.attrelid = target.oid AND attribute.attnum = key.attnum
             ) AS target_columns,
             constraint_info.confdeltype AS delete_action
      FROM pg_catalog.pg_constraint constraint_info
      JOIN pg_catalog.pg_class source ON source.oid = constraint_info.conrelid
      JOIN pg_catalog.pg_class target ON target.oid = constraint_info.confrelid
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid = source.relnamespace
      WHERE namespace.nspname = 'public' AND constraint_info.contype = 'f'
      ORDER BY source.relname, constraint_info.conname
    `
  const [relations, columns, constraints, indexes, foreignKeys] = await Promise.all([
    dataSource.query(relationsSql),
    dataSource.query(columnsSql),
    dataSource.query(constraintsSql),
    dataSource.query(indexesSql),
    dataSource.query(foreignKeysSql)
  ])
  return { relations, columns, constraints, indexes, foreignKeys }
}

const { expectedColumns, expectedConstraints, expectedIndexes, expectedForeignKeys } = JSON.parse(
  await readFile(new URL('../test/fixtures/passkey-database-schema.json', import.meta.url), 'utf8')
)

export async function assertSchema(
  dataSource,
  mark = () => undefined,
  migrationNames = [
    'InitialAuthSchema1788600000000',
    'AddCharacterDetails1789547642378',
    'AddCharacterCatalog1789554193117',
    'AddSetItemCatalog1789557135610',
    'AddCharacterAdventureName1789564164377',
    'ReplaceOAuthWithPasskeys1789566809748',
    'AddPhoneQrLogin1789601588410'
  ]
) {
  const snapshot = await databaseSnapshot(dataSource)
  mark('relations')
  assert.deepEqual(
    snapshot.relations.map(({ name }) => name),
    [...DOMAIN_TABLES, MIGRATIONS_TABLE].sort()
  )

  for (const [table, columns] of Object.entries(expectedColumns)) {
    mark(`columns ${table}`)
    assert.deepEqual(
      snapshot.columns
        .filter((column) => column.table_name === table)
        .sort((a, b) => a.column_name.localeCompare(b.column_name))
        .map((column) => [
          column.column_name,
          column.data_type,
          column.udt_name,
          column.is_nullable,
          column.collation_name,
          column.datetime_precision
        ]),
      columns,
      `column contract differs for ${table}`
    )
  }

  mark('constraints')
  const actualConstraints = snapshot.constraints
    .filter(({ table_name }) => DOMAIN_TABLES.includes(table_name))
    .map(
      ({ table_name, constraint_name, constraint_type }) =>
        `${table_name}:${constraint_name}:${constraint_type}`
    )
  const hasConstraintsToCompare = Math.max(actualConstraints.length, expectedConstraints.length) > 0
  const constraintDifference = hasConstraintsToCompare
    ? Array.from({
        length: Math.max(actualConstraints.length, expectedConstraints.length)
      }).findIndex((_, index) => actualConstraints[index] !== expectedConstraints[index])
    : -1
  const hasConstraintDifference = constraintDifference >= 0
  if (hasConstraintDifference) {
    mark(
      `constraints ${expectedConstraints[constraintDifference] ?? 'end'} ${actualConstraints[constraintDifference] ?? 'end'}`
    )
  }
  assert.deepEqual(actualConstraints, expectedConstraints)
  mark('indexes')
  assert.deepEqual(
    snapshot.indexes
      .filter(({ table_name }) => DOMAIN_TABLES.includes(table_name))
      .map(({ table_name, index_name, columns, is_unique, predicate }) => [
        table_name,
        index_name,
        columns,
        is_unique,
        predicate
      ]),
    expectedIndexes
  )
  mark('foreign keys')
  assert.deepEqual(
    snapshot.foreignKeys.map(
      ({
        source_table,
        constraint_name,
        source_columns,
        target_table,
        target_columns,
        delete_action
      }) => [
        source_table,
        constraint_name,
        source_columns,
        target_table,
        target_columns,
        delete_action
      ]
    ),
    expectedForeignKeys
  )

  mark('primary keys')
  const primaryKeysSql = `
    SELECT tc.table_name, json_agg(kcu.column_name ORDER BY kcu.ordinal_position) AS columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_schema = tc.constraint_schema AND kcu.constraint_name = tc.constraint_name
    WHERE tc.constraint_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_name = ANY($1)
    GROUP BY tc.table_name
    ORDER BY tc.table_name
  `
  const primaryKeys = await dataSource.query(primaryKeysSql, [DOMAIN_TABLES])
  assert.deepEqual(primaryKeys, [
    { table_name: 'auth_login_requests', columns: ['id'] },
    { table_name: 'auth_passkeys', columns: ['id'] },
    { table_name: 'auth_refresh_tokens', columns: ['token_hash'] },
    { table_name: 'auth_sessions', columns: ['id'] },
    { table_name: 'character_api_responses', columns: ['character_id', 'section'] },
    { table_name: 'characters', columns: ['character_id'] },
    { table_name: 'item_catalog', columns: ['item_id'] },
    { table_name: 'set_item_catalog', columns: ['set_item_id'] },
    { table_name: 'skill_catalog', columns: ['job_id', 'skill_id'] },
    { table_name: 'users', columns: ['id'] }
  ])

  mark('migration history')
  const history = await dataSource.query(`SELECT name FROM "${MIGRATIONS_TABLE}" ORDER BY id`)
  assert.deepEqual(
    history,
    migrationNames.map((name) => ({ name }))
  )
  return snapshot
}

export async function rejectConstraint(dataSource, expectedConstraint, operation) {
  const queryRunner = dataSource.createQueryRunner()
  await queryRunner.connect()
  await queryRunner.startTransaction()
  try {
    await operation(queryRunner)
    assert.fail(`constraint ${expectedConstraint} accepted invalid data`)
  } catch (error) {
    const isAssertionFailure = error?.code === 'ERR_ASSERTION'
    if (isAssertionFailure) {
      throw error
    }
    assert.equal(error?.constraint, expectedConstraint)
  } finally {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction()
    }
    await queryRunner.release()
  }
}

const userId = '10000000-0000-4000-8000-000000000001'
const sessionId = '20000000-0000-4000-8000-000000000001'
const createdAt = new Date('2026-09-05T00:00:00Z')
const later = new Date('2026-09-05T00:01:00Z')
const hash = (fill) => Buffer.alloc(32, fill)

export function loginRequest(status, id, overrides = {}) {
  const row = {
    id,
    purpose: 'login',
    configuration: 'a'.repeat(64),
    created_at: createdAt,
    expires_at: later,
    status,
    code_challenge: null,
    launch_ticket_hash: null,
    browser_binding_hash: null,
    qr_ticket_hash: null,
    phone_binding_hash: null,
    confirmation_code: null,
    webauthn_challenge: null,
    operation: null,
    pending_user_id: null,
    verified_user_id: null,
    credential_id: null,
    is_new_user: false,
    exchange_code_hash: null,
    code_expires_at: null,
    consumed_at: null
  }
  if (status === 'created') {
    Object.assign(row, { code_challenge: 'a'.repeat(43), launch_ticket_hash: randomBytes(32) })
  }
  if (status === 'browser_started') {
    Object.assign(row, { code_challenge: 'a'.repeat(43), browser_binding_hash: randomBytes(32) })
  }
  if (status === 'exchange_ready') {
    Object.assign(row, {
      code_challenge: 'a'.repeat(43),
      verified_user_id: userId,
      credential_id: 'key',
      exchange_code_hash: randomBytes(32),
      code_expires_at: later
    })
  }
  if (status === 'consumed') {
    row.consumed_at = later
  }
  return { ...row, ...overrides }
}
export async function insertLogin(source, row) {
  const names = Object.keys(row)
  await source.query(
    `INSERT INTO auth_login_requests (${names.map((n) => '"' + n + '"').join(',')}) VALUES (${names.map((_, i) => '$' + (i + 1)).join(',')})`,
    Object.values(row)
  )
}

export async function assertConstraintBehavior(dataSource) {
  await dataSource.query('INSERT INTO "users" (id, nickname, created_at) VALUES ($1, $2, $3)', [
    userId,
    'nickname',
    createdAt
  ])
  await dataSource.query(
    'INSERT INTO "auth_sessions" (id, user_id, created_at, last_active_at) VALUES ($1, $2, $3, $4)',
    [sessionId, userId, createdAt, later]
  )
  await dataSource.query(
    'INSERT INTO "auth_refresh_tokens" (token_hash, session_id, issued_at) VALUES ($1, $2, $3)',
    [hash(1), sessionId, createdAt]
  )

  await rejectConstraint(dataSource, 'ck_users_nickname_nonempty', (queryRunner) =>
    queryRunner.query('INSERT INTO "users" (id, nickname, created_at) VALUES ($1, $2, $3)', [
      '10000000-0000-4000-8000-000000000004',
      '',
      createdAt
    ])
  )
  await rejectConstraint(dataSource, 'fk_auth_sessions_user', (queryRunner) =>
    queryRunner.query(
      'INSERT INTO "auth_sessions" (id, user_id, created_at, last_active_at) VALUES ($1, $2, $3, $4)',
      [
        '20000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000009999',
        createdAt,
        later
      ]
    )
  )
  await rejectConstraint(dataSource, 'ck_auth_sessions_last_active', (queryRunner) =>
    queryRunner.query(
      'INSERT INTO "auth_sessions" (id, user_id, created_at, last_active_at) VALUES ($1, $2, $3, $4)',
      ['20000000-0000-4000-8000-000000000003', userId, later, createdAt]
    )
  )
  await rejectConstraint(dataSource, 'ck_auth_sessions_revoked_pair', (queryRunner) =>
    queryRunner.query(
      'INSERT INTO "auth_sessions" (id, user_id, created_at, last_active_at, revoked_at) VALUES ($1, $2, $3, $4, $5)',
      ['20000000-0000-4000-8000-000000000004', userId, createdAt, later, later]
    )
  )
  await rejectConstraint(dataSource, 'ck_auth_sessions_revoked_reason', (queryRunner) =>
    queryRunner.query(
      'INSERT INTO "auth_sessions" (id, user_id, created_at, last_active_at, revoked_at, revoked_reason) VALUES ($1, $2, $3, $4, $5, $6)',
      ['20000000-0000-4000-8000-000000000005', userId, createdAt, later, later, 'other']
    )
  )
  await rejectConstraint(dataSource, 'ck_auth_sessions_revoked_time', (queryRunner) =>
    queryRunner.query(
      'INSERT INTO "auth_sessions" (id, user_id, created_at, last_active_at, revoked_at, revoked_reason) VALUES ($1, $2, $3, $4, $5, $6)',
      ['20000000-0000-4000-8000-000000000006', userId, later, later, createdAt, 'logout']
    )
  )
  await rejectConstraint(dataSource, 'pk_auth_refresh_tokens', (queryRunner) =>
    queryRunner.query(
      'INSERT INTO "auth_refresh_tokens" (token_hash, session_id, issued_at, consumed_at) VALUES ($1, $2, $3, $4)',
      [hash(1), sessionId, createdAt, later]
    )
  )
  await rejectConstraint(dataSource, 'uq_auth_refresh_tokens_unconsumed_session', (queryRunner) =>
    queryRunner.query(
      'INSERT INTO "auth_refresh_tokens" (token_hash, session_id, issued_at) VALUES ($1, $2, $3)',
      [hash(2), sessionId, createdAt]
    )
  )
  await rejectConstraint(dataSource, 'fk_auth_refresh_tokens_session', (queryRunner) =>
    queryRunner.query(
      'INSERT INTO "auth_refresh_tokens" (token_hash, session_id, issued_at) VALUES ($1, $2, $3)',
      [hash(3), '20000000-0000-4000-8000-000000009999', createdAt]
    )
  )
  await rejectConstraint(dataSource, 'ck_auth_refresh_tokens_hash_length', (queryRunner) =>
    queryRunner.query(
      'INSERT INTO "auth_refresh_tokens" (token_hash, session_id, issued_at, consumed_at) VALUES ($1, $2, $3, $4)',
      [Buffer.alloc(31), sessionId, createdAt, later]
    )
  )
  await rejectConstraint(dataSource, 'ck_auth_refresh_tokens_consumed_time', (queryRunner) =>
    queryRunner.query(
      'INSERT INTO "auth_refresh_tokens" (token_hash, session_id, issued_at, consumed_at) VALUES ($1, $2, $3, $4)',
      [hash(4), sessionId, later, createdAt]
    )
  )

  for (const status of ['created', 'browser_started', 'exchange_ready', 'consumed', 'failed']) {
    await insertLogin(dataSource, loginRequest(status, randomUUID()))
  }
  for (const [constraint, row] of [
    [
      'ck_passkey_request_created',
      loginRequest('created', randomUUID(), { launch_ticket_hash: null })
    ],
    [
      'ck_passkey_request_ready',
      loginRequest('exchange_ready', randomUUID(), { verified_user_id: null })
    ],
    [
      'ck_passkey_request_terminal_phone',
      loginRequest('consumed', randomUUID(), { code_challenge: 'retained' })
    ],
    [
      'ck_passkey_request_browser_binding_hash',
      loginRequest('browser_started', randomUUID(), { browser_binding_hash: Buffer.alloc(31) })
    ],
    ['ck_passkey_request_status_phone', loginRequest('processing', randomUUID())]
  ]) {
    await rejectConstraint(dataSource, constraint, (runner) => insertLogin(runner, row))
  }

  await dataSource.query('DELETE FROM "users" WHERE id = $1', [userId])
  const cascadeCountsSql = `
    SELECT
      (SELECT count(*)::int FROM "auth_sessions" WHERE user_id = $1) AS sessions,
      (SELECT count(*)::int FROM "auth_refresh_tokens" WHERE session_id = $2) AS refresh_tokens
  `
  const cascadeCounts = await dataSource.query(cascadeCountsSql, [userId, sessionId])
  assert.deepEqual(cascadeCounts, [{ sessions: 0, refresh_tokens: 0 }])
}
