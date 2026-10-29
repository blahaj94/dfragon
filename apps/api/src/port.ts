const configurationError = 'Invalid server configuration'

const SERVER_PORT_PATTERN = /^[0-9]+$/

export function parsePort(value: string | undefined): number {
  if (value === undefined || !SERVER_PORT_PATTERN.test(value)) {
    throw new Error(configurationError)
  }

  const port = Number(value)
  if (port < 1 || port > 65_535) {
    throw new Error(configurationError)
  }

  return port
}
