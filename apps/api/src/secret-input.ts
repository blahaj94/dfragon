import { readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'

const MOUNTED_SECRET_TERMINATOR_PATTERN = /\n+$/

/** Read one explicit secret source without exposing its value or filesystem errors. */
export function readSecretInput(
  value: string | undefined,
  file: string | undefined
): string | undefined {
  try {
    if (value !== undefined && file !== undefined) {
      throw new Error()
    }

    if (file !== undefined) {
      if (!isAbsolute(file)) {
        throw new Error()
      }
      // Match the existing mounted-secret entrypoint's trailing LF handling.
      value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
        .decode(readFileSync(file))
        .replace(MOUNTED_SECRET_TERMINATOR_PATTERN, '')
    }

    if (value !== undefined && value.trim() === '') {
      throw new Error()
    }

    return value
  } catch {
    throw new Error('Invalid secret input')
  }
}
