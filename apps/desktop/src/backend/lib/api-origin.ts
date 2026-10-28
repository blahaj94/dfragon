const MAX_URL_BYTES = 2_048

export class ApiOriginFailure extends Error {
  constructor() {
    super('API origin is invalid.')
    this.name = 'ApiOriginFailure'
    this.stack = `${this.name}: ${this.message}`
  }
}

function hasForbiddenUrlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!
    const isControlOrSpace = codePoint <= 0x20 || codePoint === 0x7f
    if (isControlOrSpace || character === '\\') {
      return true
    }
  }

  return false
}

function parseExactUrl(raw: unknown): URL {
  // 설정 값이 문자열이 아니면 URL 내부 접근이나 coercion 없이 거절한다.
  if (typeof raw !== 'string') {
    throw new ApiOriginFailure()
  }
  const isWithinLimit = Buffer.byteLength(raw, 'utf8') <= MAX_URL_BYTES
  if (!isWithinLimit || hasForbiddenUrlCharacter(raw)) {
    throw new ApiOriginFailure()
  }

  try {
    return new URL(raw)
  } catch {
    throw new ApiOriginFailure()
  }
}

export function validateApiOrigin(apiOrigin: string): string {
  const url = parseExactUrl(apiOrigin)
  const hasNoCredentials = url.username.length === 0 && url.password.length === 0
  const isValidOrigin =
    url.protocol === 'https:' &&
    hasNoCredentials &&
    url.pathname === '/' &&
    url.search.length === 0 &&
    url.hash.length === 0 &&
    url.origin === apiOrigin
  if (!isValidOrigin) {
    throw new ApiOriginFailure()
  }

  return apiOrigin
}
