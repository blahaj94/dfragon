import { isCanonicalOpaque } from './pkce'

const MAX_URL_BYTES = 2_048
const MIN_LOOPBACK_PORT = 1_024
const MAX_LOOPBACK_PORT = 65_535

function hasForbiddenUrlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!
    const isControlOrSpace = codePoint <= 0x20 || codePoint === 0x7f
    const isBackslash = character === '\\'
    const isForbidden = isControlOrSpace || isBackslash
    if (isForbidden) {
      return true
    }
  }

  return false
}

export class AuthProtocolFailure extends Error {
  constructor() {
    super('Authentication URL is invalid.')
    this.name = 'AuthProtocolFailure'
    this.stack = `${this.name}: ${this.message}`
  }
}

function parseExactUrl(raw: unknown): URL {
  const isString = typeof raw === 'string'
  let isWithinLimit: boolean | undefined
  let hasForbiddenCharacter: boolean | undefined
  if (isString) {
    isWithinLimit = Buffer.byteLength(raw, 'utf8') <= MAX_URL_BYTES
    hasForbiddenCharacter = hasForbiddenUrlCharacter(raw)
  }
  const canParse = isString && isWithinLimit !== false && hasForbiddenCharacter !== true
  if (!canParse) {
    throw new AuthProtocolFailure()
  }

  try {
    return new URL(raw)
  } catch {
    throw new AuthProtocolFailure()
  }
}

export function validateApiOrigin(apiOrigin: string): string {
  const url = parseExactUrl(apiOrigin)
  const isHttps = url.protocol === 'https:'
  const hasNoUsername = url.username.length === 0
  let hasNoPassword: boolean | undefined
  if (hasNoUsername) {
    hasNoPassword = url.password.length === 0
  }
  const hasNoCredentials = hasNoUsername && hasNoPassword === true
  const hasRootPath = url.pathname === '/'
  const hasNoQuery = url.search.length === 0
  const hasNoFragment = url.hash.length === 0
  const isCanonicalOrigin = url.origin === apiOrigin
  const isValidOrigin =
    isHttps && hasNoCredentials && hasRootPath && hasNoQuery && hasNoFragment && isCanonicalOrigin
  if (!isValidOrigin) {
    throw new AuthProtocolFailure()
  }

  return apiOrigin
}

export function validateBrowserLaunchUrl(raw: unknown, apiOrigin: string): string {
  const trustedOrigin = validateApiOrigin(apiOrigin)
  const url = parseExactUrl(raw)
  const tickets = url.searchParams.getAll('ticket')
  const hasOneQueryParameter = url.searchParams.size === 1
  let hasOneTicket: boolean | undefined
  if (hasOneQueryParameter) {
    hasOneTicket = tickets.length === 1
  }
  const hasOneQuery = hasOneQueryParameter && hasOneTicket === true
  const ticket = tickets[0]
  const isCanonicalTicket = isCanonicalOpaque(ticket)
  const expected = isCanonicalTicket
    ? `${trustedOrigin}/auth/login/authorize?ticket=${ticket}`
    : null
  const hasExpectedLaunchUrl = expected != null
  const isExactLaunchUrl = hasExpectedLaunchUrl ? raw === expected : undefined
  const isValidLaunchUrl = hasOneQuery && isCanonicalTicket && isExactLaunchUrl === true
  if (!isValidLaunchUrl) {
    throw new AuthProtocolFailure()
  }

  if (!hasExpectedLaunchUrl) {
    throw new AuthProtocolFailure()
  }

  return expected
}

export function formatLoopbackReturnUrl(port: number): string {
  return `http://127.0.0.1:${port}/auth/callback`
}

export function validateLoopbackReturnUrl(returnUrl: string): string {
  const url = parseExactUrl(returnUrl)
  const port = Number(url.port)
  const expected = formatLoopbackReturnUrl(port)
  const isEphemeralPort =
    Number.isInteger(port) && port >= MIN_LOOPBACK_PORT && port <= MAX_LOOPBACK_PORT
  const isExactReturnUrl = returnUrl === expected
  const isValidReturnUrl = isEphemeralPort && isExactReturnUrl
  if (!isValidReturnUrl) {
    throw new AuthProtocolFailure()
  }

  return returnUrl
}

export function parseReturnUrl(raw: unknown, returnUrl: string): Readonly<{ code: string }> {
  return parseCodeReturnUrl(raw, validateLoopbackReturnUrl(returnUrl))
}

// 기대 주소가 없는 pending 없는 복귀에서 새 로그인 안내 여부를 정할 때만 형식을 확인한다.
export function isLoopbackReturnUrl(raw: unknown): boolean {
  try {
    const port = Number(parseExactUrl(raw).port)
    parseReturnUrl(raw, formatLoopbackReturnUrl(port))

    return true
  } catch {
    return false
  }
}

function parseCodeReturnUrl(raw: unknown, trustedTarget: string): Readonly<{ code: string }> {
  const url = parseExactUrl(raw)
  const codes = url.searchParams.getAll('code')
  const hasOneQueryParameter = url.searchParams.size === 1
  let hasOneCode: boolean | undefined
  if (hasOneQueryParameter) {
    hasOneCode = codes.length === 1
  }
  const hasOneQuery = hasOneQueryParameter && hasOneCode === true
  const code = codes[0]
  const isCanonicalCode = isCanonicalOpaque(code)
  const expected = isCanonicalCode ? `${trustedTarget}?code=${code}` : null
  const hasExpectedReturnUrl = expected != null
  const isExactReturnUrl = hasExpectedReturnUrl ? raw === expected : undefined
  const isValidReturnUrl = hasOneQuery && isCanonicalCode && isExactReturnUrl === true
  if (!isValidReturnUrl) {
    throw new AuthProtocolFailure()
  }

  return { code }
}
