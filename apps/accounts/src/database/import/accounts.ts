import type { Client } from 'pg'

const tables = [
  { name: 'users', columns: ['id', 'nickname', 'created_at'] },
  {
    name: 'auth_passkeys',
    columns: [
      'id',
      'user_id',
      'public_key',
      'counter',
      'transports',
      'device_type',
      'backed_up',
      'created_at',
      'last_used_at'
    ]
  },
  {
    name: 'auth_sessions',
    columns: ['id', 'user_id', 'created_at', 'last_active_at', 'revoked_at', 'revoked_reason']
  },
  { name: 'auth_refresh_tokens', columns: ['token_hash', 'session_id', 'issued_at', 'consumed_at'] }
] as const

export function validateLegacyRpId(value: string): string {
  const url = new URL(`https://${value}`)
  if (
    value.length > 253 ||
    url.hostname !== value ||
    url.origin !== `https://${value}` ||
    !value.includes('.')
  ) {
    throw new Error('Invalid legacy RP ID')
  }
  return value
}

/** Run only with all old authentication writers stopped. Source rows are never modified. */
export async function importAccounts(
  source: Client,
  target: Client,
  legacyRpId: string
): Promise<Record<string, number>> {
  validateLegacyRpId(legacyRpId)
  const counts: Record<string, number> = {}
  try {
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
    await target.query('BEGIN')
    await source.query("SET LOCAL lock_timeout = '5s'")
    await target.query("SET LOCAL lock_timeout = '5s'")
    // Locks also reject accidentally importing into the same database through two aliases.
    await source.query(`LOCK TABLE ${tables.map(({ name }) => name).join(', ')} IN SHARE MODE`)
    await target.query(
      `LOCK TABLE ${tables.map(({ name }) => name).join(', ')}, auth_login_requests, auth_passkey_migrations IN ACCESS EXCLUSIVE MODE`
    )
    for (const name of [
      ...tables.map((table) => table.name),
      'auth_login_requests',
      'auth_passkey_migrations'
    ]) {
      const rows = await target.query(`SELECT 1 FROM ${name} LIMIT 1`)
      if (rows.rowCount !== 0) {
        throw new Error('Target authentication database must be empty')
      }
    }
    // A new-RP or already-split source is not the legacy database this importer understands.
    const sourceShape = await source.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'auth_passkeys' AND column_name = 'rp_id'"
    )
    if (sourceShape.rowCount !== 0) {
      throw new Error('Expected the legacy authentication schema')
    }
    for (const table of tables) {
      const extraRp = table.name === 'auth_passkeys'
      const columns = [...table.columns, ...(extraRp ? ['rp_id'] : [])]
      await source.query(
        `DECLARE account_import NO SCROLL CURSOR FOR SELECT ${table.columns.join(', ')} FROM ${table.name}`
      )
      counts[table.name] = 0
      while (true) {
        const batch = await source.query(`FETCH 500 FROM account_import`)
        if (batch.rowCount === 0) {
          break
        }
        const values: unknown[] = []
        const tuples = batch.rows.map((row: Record<string, unknown>) => {
          const fields = table.columns.map((column) =>
            column === 'transports' ? JSON.stringify(row[column]) : row[column]
          )
          if (extraRp) {
            fields.push(legacyRpId)
          }
          return `(${fields
            .map((value) => {
              values.push(value)
              return `$${values.length}`
            })
            .join(', ')})`
        })
        const inserted = await target.query(
          `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`,
          values
        )
        if (inserted.rowCount !== batch.rowCount) {
          throw new Error('Import count mismatch')
        }
        counts[table.name] += batch.rowCount ?? 0
      }
      await source.query('CLOSE account_import')
      const targetCount = await target.query(`SELECT count(*)::text AS count FROM ${table.name}`)
      if (targetCount.rows[0].count !== String(counts[table.name])) {
        throw new Error('Import count mismatch')
      }
    }
    await target.query('SET CONSTRAINTS ALL IMMEDIATE')
    await target.query('COMMIT')
    return counts
  } finally {
    // A lost COMMIT acknowledgement must be treated as indeterminate. Never empty/retry automatically.
    await Promise.allSettled([source.query('ROLLBACK'), target.query('ROLLBACK')])
  }
}
