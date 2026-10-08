export type ServerService = 'api' | 'accounts' | 'ocr'

export interface ServerBuildInfo {
  service: ServerService
  commit: string | null
}

const SERVER_COMMIT_PATTERN = /^[0-9a-f]{40}$/

/** Accept only the requested service and a complete image-build revision. */
export function parseServerBuildInfo(
  value: unknown,
  expectedService: ServerService
): ServerBuildInfo | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  if (
    Object.keys(value).length !== 2 ||
    !Object.hasOwn(value, 'service') ||
    !Object.hasOwn(value, 'commit')
  ) {
    return null
  }
  const info = value as Record<string, unknown>
  if (
    info.service !== expectedService ||
    (info.commit !== null &&
      (typeof info.commit !== 'string' ||
        info.commit.length !== 40 ||
        !SERVER_COMMIT_PATTERN.test(info.commit)))
  ) {
    return null
  }

  return { service: expectedService, commit: info.commit }
}
