import { readSecretInput } from '../secret-input.js'

export interface DatabaseConfiguration {
  host: string
  port: number
  username: string
  password: string
  database: string
}

const configurationError = 'Invalid database configuration'

function required(value: string | undefined): string {
  const isValueMissing = value === undefined
  if (isValueMissing) {
    throw new Error(configurationError)
  }

  const isValueEmpty = value.length === 0
  if (isValueEmpty) {
    throw new Error(configurationError)
  }

  return value
}

export function readDatabaseConfiguration(env: NodeJS.ProcessEnv): DatabaseConfiguration {
  try {
    const portText = required(env.DB_PORT)
    const isPortDecimal = /^[0-9]+$/.test(portText)
    if (!isPortDecimal) {
      throw new Error(configurationError)
    }
    const port = Number(portText)
    const isPortSafeInteger = Number.isSafeInteger(port)
    const isPortBelowMinimum = port < 1
    const isPortAboveMaximum = port > 65_535
    const isPortInvalid = !isPortSafeInteger || isPortBelowMinimum || isPortAboveMaximum
    if (isPortInvalid) {
      throw new Error(configurationError)
    }
    const host = required(env.DB_HOST)
    const username = required(env.DB_USERNAME)
    const password = required(readSecretInput(env.DB_PASSWORD, env.DB_PASSWORD_FILE))
    const database = required(env.DB_NAME)

    return { host, port, username, password, database }
  } catch {
    throw new Error(configurationError)
  }
}
