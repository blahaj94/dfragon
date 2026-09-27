import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { Client } from 'pg'
import { readDatabaseConfiguration } from '../configuration.js'
import { importAccounts, validateLegacyRpId } from './accounts.js'

const clients: Client[] = []
try {
  if (process.argv.length !== 3 || process.argv[2] !== '--writes-stopped') {
    throw new Error('Maintenance acknowledgement required')
  }
  const path = process.env.AUTH_IMPORT_SOURCE_FILE
  if (path === undefined || !isAbsolute(path)) {
    throw new Error('Source configuration required')
  }
  const value: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid source configuration')
  }
  const input = value as Record<string, unknown>
  if (
    Object.keys(input).sort().join(',') !== 'DB_HOST,DB_NAME,DB_PASSWORD,DB_PORT,DB_USERNAME' ||
    Object.values(input).some((entry) => typeof entry !== 'string')
  ) {
    throw new Error('Invalid source configuration')
  }
  const sourceConfig = readDatabaseConfiguration(input as NodeJS.ProcessEnv)
  const targetConfig = readDatabaseConfiguration(process.env)
  const rpId = validateLegacyRpId(process.env.AUTH_IMPORT_LEGACY_RP_ID ?? '')
  if (
    sourceConfig.database === targetConfig.database &&
    sourceConfig.host === targetConfig.host &&
    sourceConfig.port === targetConfig.port
  ) {
    throw new Error('Source and target must differ')
  }
  for (const { username, ...configuration } of [sourceConfig, targetConfig]) {
    const client = new Client({ ...configuration, user: username, connectionTimeoutMillis: 5000 })
    clients.push(client)
    await client.connect()
  }
  const counts = await importAccounts(clients[0]!, clients[1]!, rpId)
  process.stdout.write(`Authentication import committed: ${JSON.stringify(counts)}\n`)
} catch {
  process.stderr.write(
    'Authentication import failed. Keep authentication stopped and inspect target counts before retrying.\n'
  )
  process.exitCode = 1
} finally {
  const results = await Promise.allSettled(clients.map((client) => client.end()))
  if (results.some((result) => result.status === 'rejected')) {
    process.exitCode = 1
  }
}
